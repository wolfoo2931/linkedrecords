var Changeset = require('changesets').Changeset,
    diffMatchPatch = require('diff_match_patch'),
    diffEngine = new diffMatchPatch.diff_match_patch,
    queue = require('queue')({concurrency: 1, autostart: true}),
    Storage = require('./db/psql');

class Attribute {
    static async create(args) {
        if(!args.actorId) {
            throw new Error('actorId argument must be present');
        }

        if(!args.value) {
            throw new Error('value argument must be present');
        }

        if(!args.actorId.match(/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)) {
            throw new Error('actorId is "' + args.actorId + '" but it must be a valid uuid');
        }

        return await Storage.createAttribute(actorId, value)
    }

    static async get(args) {
        if(!args.variableId) {
            throw new Error('variableId argument must be present');
        }

        const queryOptions = args.changeId ? { maxChangeId: args.changeId } : {};
        const result = await Storage.getAttributeLatestSnapshot(args.variableId, queryOptions);
        const changes = await Storage.getAttributeChanges(args.variableId, queryOptions);

        changes.forEach((change) => {
            result.value = Changeset.unpack(change.value).apply(result.value);
            result.changeId = change.changeId;
            result.actorId = change.actorId;
        })

        return result
    }

    static set(args) {
        return new Promise(resolve => {
            queue.push((cb) => {
                this._changeVariable(args).then((result) => {
                    resolve(result);
                    cb();
                });
            });
        })
    }

    static async _changeVariable(args) {
        if(!args.variableId) {
            throw new Error('variableId argument must be present');
        }

        if(!args.value && !args.change) {
            throw new Error('either value or changeset argument must be present');
        }

        if(args.value && args.change) {
            throw new Error('either value or change argument must be present (specifying both is not allowed)');
        }

        if(args.change) {
            try {
                Changeset.unpack(args.change.changeset);
            } catch(err) {
                throw new Error('the specified changeset is invalid (must be a string that has been serialized with changeset.pack(); see: https://github.com/marcelklehr/changesets/blob/master/lib/Changeset.js#L320-L337)');
            }

            if(!args.change.parentVersion) {
                throw new Error('the changeset must also contain a parent version');
            }
        }

        if(!args.actorId) {
            throw new Error('actorId argument must be present');
        }

        if(!args.actorId.match(/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)) {
            throw new Error('actorId is "' + args.actorId + '" but it must be a valid uuid');
        }

        if(args.value) {
            return await Storage.insertAttributeSnapshot(args.variableId, args.actorId, args.value);
        } else if(args.change) {
            return await this._changeVariableByChangeset(args);
        }
    }

    // Applies the changeset which can be based on an older version of the veriable value.
    // This is because the client which constructed the changeset might not have the latest changes from the server
    // This is the "one-step diamond problem" in operational transfomration
    // see: http://www.codecommit.com/blog/java/understanding-and-applying-operational-transformation
    static async _changeVariableByChangeset(args) {
        const parentVersion = await this.get({variableId: args.variableId, changeId: args.change.parentVersion});
        const currentVersion = await this.get({variableId: args.variableId});

        // the a in the simple one-step diamond problem
        // the changeset comming from the client, probably made on an older version of the variable (the server version migth be newr)
        const clientChange = Changeset.unpack(args.change.changeset);

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
            args.variableId,
            args.actorId,
            transformedClientChange
        );

        return {
            id: changeID,
            clientId: args.clientId,
            transformedServerChange: transformedServerChange,
            transformedClientChange: transformedClientChange
        }
    }
}

module.exports = Attribute;
