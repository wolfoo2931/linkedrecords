var RemoteVariable = require('../js_sdk/remote_variable'),
    UUID = require('../js_sdk/uuid'),
    Editor = require('structured-text-editor/src/editor'),
    Changeset = require('changesets').Changeset,
    remoteVariable;

document.addEventListener("DOMContentLoaded", async function(event) {
    var clientId = actorId = (new UUID()).getValue(),
        variableId = new URLSearchParams(window.location.search).get('variable-id'),
        editor = new Editor('value');

    remoteVariable = new RemoteVariable(variableId, 'http://localhost:3000', clientId, actorId);
    await remoteVariable.load();

    editor.setContent(remoteVariable.getValue());

    remoteVariable.subscribe(function(changeset, changeInfo) {
        const attr = { actor: { id: changeInfo.actorId } };

        try {
            editor.applyChangeset(changeset, attr);
        } catch(ex) {
            console.log('failed to apply changeset to editors content. Falling back to replace the whole editors content', ex)
            editor.setContent(remoteVariable.getValue(), attr);
        }
    });

    editor.subscribe(function(modificationLog) {
        if(!modificationLog.actor) {
            try {
                remoteVariable.applyChangeset(modificationLog.toChangeset(Changeset));
            } catch(ex) {
                console.log('error appling changeseet to remote variable. Falling back to replace whole variable content', ex);
                remoteVariable.setValue(editor.getOriginalContent());
            }
        }
    });
});
