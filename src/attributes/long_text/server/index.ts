import { Changeset } from 'changesets';
import { diff_match_patch as DiffMatchPatch} from 'diff_match_patch';
import { PsqlStorage as Storage } from './db/psql';

const diffEngine = new DiffMatchPatch();
const queue = require('queue')({ concurrency: 1, autostart: true });

export class LongTextAttribute {

    static readonly DATA_TYPE_NAME = 'longText';
    static readonly DATA_TYPE_PREFIX = 'l';

    id: string;
    actorId: string;
    clientId: string;

    constructor(id: string, clientId: string, actorId: string) {
        this.id = id;
        this.clientId = clientId;
        this.actorId = actorId;
    }

    async create(value: string) : Promise<string> {
        return await Storage.createAttribute(this.id, this.actorId, value);
    }

    async get() : Promise<{ value: string, changeId: string, actorId: string }> {
        return await this.getByChangeId('2147483647');
    }

    async set(value: string) : Promise<{id: string}> {
        return await new Promise(resolve => {
            queue.push(async cb => {
                const result = await Storage.insertAttributeSnapshot(this.id, this.actorId, value);
                resolve(result);
                cb();
            });
        });
    }

    async change(changeset: any, parentVersion: string) : Promise<{ id: string }> {
        try {
            Changeset.unpack(changeset);
        } catch(err) {
            throw new Error('the specified changeset is invalid (must be a string that has been serialized with changeset.pack(); see: https://github.com/marcelklehr/changesets/blob/master/lib/Changeset.js#L320-L337)');
        }

        if(!parentVersion) {
            throw new Error('the changeset must also contain a parent version');
        }

        return await new Promise(resolve => {
            queue.push(async cb => {
                const result = await this.changeByChangeset(changeset, parentVersion);
                resolve(result);
                cb();
            });
        });
    }

    private async getByChangeId(changeId: string) : Promise<{value: string, changeId: string, actorId: string}> {
        const queryOptions = { maxChangeId: changeId };
        const result = await Storage.getAttributeLatestSnapshot(this.id, queryOptions);
        const changes = await Storage.getAttributeChanges(this.id, queryOptions);

        changes.forEach(change => {
            result.value = Changeset.unpack(change.value).apply(result.value);
            result.changeId = change.changeId;
            result.actorId = change.actorId;
        })

        return result;
    }

    // Applies the changeset which can be based on an older version of the veriable value.
    // This is because the client which constructed the changeset might not have the latest changes from the server
    // This is the "one-step diamond problem" in operational transfomration
    // see: http://www.codecommit.com/blog/java/understanding-and-applying-operational-transformation
    private async changeByChangeset(changeset: any, parentVersion: string) : Promise<{ id: string, clientId: string, actorId: string, transformedServerChange: any, transformedClientChange: any }> {
        const parentVersionState = await this.getByChangeId(parentVersion);
        const currentVersionState = await this.get();

        // the a in the simple one-step diamond problem
        // the changeset comming from the client, probably made on an older version of the attribute (the server version migth be newr)
        const clientChange = Changeset.unpack(changeset);

        // the b in the simple one-step diamond problem
        //the compound changes on the server side which are missing on the client site (the changeset from the client site does not consider this changes)
        const serverChange = Changeset.fromDiff(diffEngine.diff_main(parentVersionState.value, currentVersionState.value));

        // the a' in the simple one-step diamond problem
        // this changeset will be applied to the current server sate and send to all clients
        // This works because of the TP1 property of the transformAgainst function
        // see: https://en.wikipedia.org/wiki/Operational_transformation#Convergence_properties
        const transformedClientChange = clientChange.transformAgainst(serverChange, false).pack();

        // the b' in the simple one-step diamond problem
        // this changeset will be applied on the client who made the change that does not respect the serverChange
        // This works because of the TP1 property of the transformAgainst function
        // see: https://en.wikipedia.org/wiki/Operational_transformation#Convergence_properties
        const transformedServerChange = serverChange.transformAgainst(clientChange, true).pack();

        const changeID = await Storage.insertAttributeChange(
            this.id,
            this.actorId,
            transformedClientChange
        );

        return {
            id: changeID,
            clientId: this.clientId,
            actorId: this.actorId,
            transformedServerChange,
            transformedClientChange
        }
    }
}