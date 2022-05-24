var RemoteVariable = require('../js_sdk/remote_variable'),
    UUID = require('../js_sdk/uuid'),
    Editor = require('structured-text-editor/src/editor'),
    remoteVariable;

document.addEventListener("DOMContentLoaded", function(event) {
    var clientId = actorId = (new UUID()).getValue(),
        variableId = new URLSearchParams(window.location.search).get('variable-id'),
        editor = new Editor('value');

    remoteVariable = new RemoteVariable(variableId, 'http://localhost:3000', clientId, actorId)

    remoteVariable.load(() => {
        editor.setContent(remoteVariable.getValue())

        remoteVariable.subscribe(function(changeset) {
            console.log('setValue', remoteVariable.getValue());

            editor.setContent(remoteVariable.getValue());
        });

        editor.subscribe(function(content) {
            const c = editor.getContent().replace(/ class="focused"/g, '').replace(/ class=""/g, '')
            console.log('setValue', c)
            remoteVariable.setValue(c);
        });
    });
});
