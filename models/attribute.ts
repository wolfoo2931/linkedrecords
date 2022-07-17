import { Changeset } from 'changesets';
import { diff_match_patch as DiffMatchPatch} from 'diff_match_patch';
import { PsqlStorage as Storage } from './db/psql';

const diffEngine = new DiffMatchPatch();
const queue = require('queue')({ concurrency: 1, autostart: true });

export class Attribute {
    static async create(actorId: string, value: string) {
        return await Storage.createAttribute(actorId, value)
    }

    static async get(id: string, changeId?: string) {
        const queryOptions = changeId ? { maxChangeId: changeId } : {};
        const result = await Storage.getAttributeLatestSnapshot(id, queryOptions);
        const changes = await Storage.getAttributeChanges(id, queryOptions);

        changes.forEach((change) => {
            result.value = Changeset.unpack(change.value).apply(result.value);
            result.changeId = change.changeId;
            result.actorId = change.actorId;
        })

        return result
    }

    static set(id, actorId, value) {
        return new Promise(resolve => {
            queue.push(async cb => {
                const result = await Storage.insertAttributeSnapshot(id, actorId, value);
                resolve(result);
                cb();
            });
        });
    }

    static change(id: string, change: any, actorId: string, clientId: string) {
        try {
            Changeset.unpack(change.changeset);
        } catch(err) {
            throw new Error('the specified changeset is invalid (must be a string that has been serialized with changeset.pack(); see: https://github.com/marcelklehr/changesets/blob/master/lib/Changeset.js#L320-L337)');
        }

        if(!change.parentVersion) {
            throw new Error('the changeset must also contain a parent version');
        }

        return new Promise(resolve => {
            queue.push(async cb => {
                const result = await this._changeVariableByChangeset(id, change, actorId, clientId);
                resolve(result);
                cb();
            });
        });
    }

    // Applies the changeset which can be based on an older version of the veriable value.
    // This is because the client which constructed the changeset might not have the latest changes from the server
    // This is the "one-step diamond problem" in operational transfomration
    // see: http://www.codecommit.com/blog/java/understanding-and-applying-operational-transformation
    static async _changeVariableByChangeset(id: string, change: any, actorId: string, clientId: string) {
        const parentVersion = await this.get(id, change.parentVersion);
        const currentVersion = await this.get(id);

        // the a in the simple one-step diamond problem
        // the changeset comming from the client, probably made on an older version of the variable (the server version migth be newr)
        const clientChange = Changeset.unpack(change.changeset);

        // the b in the simple one-step diamond problem
        //the compound changes on the server side which are missing on the client site (the changeset from the client site does not consider this changes)
        const serverChange = Changeset.fromDiff(diffEngine.diff_main(parentVersion.value, currentVersion.value));

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
            id,
            actorId,
            transformedClientChange
        );

        return {
            id: changeID,
            clientId,
            actorId,
            transformedServerChange,
            transformedClientChange
        }
    }
}