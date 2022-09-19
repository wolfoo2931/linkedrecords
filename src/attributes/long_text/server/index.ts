import { AttributeStorage }  from './db';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import LongTextChange from '../long_text_change';

export { PsqlStorage, AttributeStorage }  from './db';

const queue = require('queue')({ concurrency: 1, autostart: true });

export class LongTextAttribute extends AbstractAttributeServer<string, LongTextChange, AttributeStorage> {

    static readonly DATA_TYPE_NAME = 'longText';
    static readonly DATA_TYPE_PREFIX = 'l';

    async create(value: string) : Promise<{ id: string }> {
        return await this.storage.createAttribute(this.id, this.actorId, value);
    }

    async get() : Promise<{ value: string, changeId: string, actorId: string }> {
        return await this.getByChangeId('2147483647');
    }

    async set(value: string) : Promise<{id: string}> {
        return await new Promise(resolve => {
            queue.push(async cb => {
                const result = await this.storage.insertAttributeSnapshot(this.id, this.actorId, value);
                resolve(result);
                cb();
            });
        });
    }

    async change(changeWithMetadata: SerializedChangeWithMetadata<LongTextChange>) : Promise<SerializedChangeWithMetadata<LongTextChange>> {
        const serializedChangeset = changeWithMetadata.change.changeset;
        const parentVersion = changeWithMetadata.change.changeId;

        try {
            LongTextChange.fromString(serializedChangeset);
        } catch(err) {
            throw new Error('the specified changeset is invalid (must be a string that has been serialized with changeset.pack(); see: https://github.com/marcelklehr/changesets/blob/master/lib/Changeset.js#L320-L337)');
        }

        if(!parentVersion) {
            throw new Error('the changeset must also contain a parent version');
        }

        return await new Promise((resolve, reject) => {
            queue.push(async cb => {
                try {
                    const result = await this.changeByChangeset(LongTextChange.fromString(serializedChangeset), parentVersion);
                    resolve(new SerializedChangeWithMetadata(
                        this.id,
                        result.actorId,
                        result.clientId,
                        new LongTextChange(result.transformedClientChange, result.changeId)
                    ));
                } catch (ex) {
                    reject(ex);
                }

                cb();
            });
        });
    }

    private async getByChangeId(changeId: string) : Promise<{value: string, changeId: string, actorId: string}> {
        const queryOptions = { maxChangeId: changeId };
        const result = await this.storage.getAttributeLatestSnapshot(this.id, queryOptions);
        const changes = await this.storage.getAttributeChanges(this.id, queryOptions);

        changes.forEach(change => {
            result.value = LongTextChange.fromString(change.value).apply(result.value);
            result.changeId = change.changeId;
            result.actorId = change.actorId;
        })

        return result;
    }

    // Applies the changeset which can be based on an older version of the veriable value.
    // This is because the client which constructed the changeset might not have the latest changes from the server
    // This is the "one-step diamond problem" in operational transfomration
    // see: http://www.codecommit.com/blog/java/understanding-and-applying-operational-transformation
    private async changeByChangeset(changeset: LongTextChange, parentVersion: string) : Promise<{ changeId: string, clientId: string, actorId: string, transformedServerChange: string, transformedClientChange: string }> {
        const parentVersionState = await this.getByChangeId(parentVersion);
        const currentVersionState = await this.get();

        // the a in the simple one-step diamond problem
        // the changeset comming from the client, probably made on an older version of the attribute (the server version migth be newr)
        const clientChange = changeset;

        // the b in the simple one-step diamond problem
        //the compound changes on the server side which are missing on the client site (the changeset from the client site does not consider this changes)
        const serverChange = LongTextChange.fromDiff(parentVersionState.value, currentVersionState.value);

        // the a' in the simple one-step diamond problem
        // this changeset will be applied to the current server sate and send to all clients
        // This works because of the TP1 property of the transformAgainst function
        // see: https://en.wikipedia.org/wiki/Operational_transformation#Convergence_properties
        const transformedClientChange = clientChange.transformAgainst(serverChange, false).toString();

        // the b' in the simple one-step diamond problem
        // this changeset will be applied on the client who made the change that does not respect the serverChange
        // This works because of the TP1 property of the transformAgainst function
        // see: https://en.wikipedia.org/wiki/Operational_transformation#Convergence_properties
        const transformedServerChange = serverChange.transformAgainst(clientChange, true).toString();

        const changeID = await this.storage.insertAttributeChange(
            this.id,
            this.actorId,
            transformedClientChange
        );

        return {
            changeId: changeID,
            clientId: this.clientId,
            actorId: this.actorId,
            transformedServerChange,
            transformedClientChange
        }
    }
}