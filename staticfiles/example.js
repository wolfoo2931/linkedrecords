var RemoteVariable = require('../js_sdk/remote_variable'),
    UUID = require('../js_sdk/uuid'),
    Editor = require('structured-text-editor/src/editor'),
    Changeset = require('changesets').Changeset,
    remoteVariable;

document.addEventListener("DOMContentLoaded", async function(event) {
    var clientId = actorId = (new UUID()).getValue(),
        variableId = new URLSearchParams(window.location.search).get('variable-id'),
        editor = new Editor('value');

    remoteVariable = new RemoteVariable(variableId, 'http://localhost:3000', clientId, actorId)
    await remoteVariable.load()

    editor.setContent(remoteVariable.getValue())

    remoteVariable.subscribe(function(changeset, changeInfo) {
        editor.setContent(
            remoteVariable.getValue(),
            { actor: { id: changeInfo.actorId } }
        );
    });

    editor.subscribe(function(modificationLog) {
        const c = editor.getOriginalContent();
        remoteVariable.setValue(c);
    });
});
