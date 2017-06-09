var RemoteVariable = require('../js_sdk/remote_variable'),
    UUID = require('../js_sdk/uuid'),
    Editor = require('../js_sdk/editor');


document.addEventListener("DOMContentLoaded", function(event) {
    var clientId = actorId = (new UUID()).getValue(),
        variableId = new URLSearchParams(window.location.search).get('variable-id'),
        remoteVariable = new RemoteVariable(variableId, 'http://localhost:3000', clientId, actorId).load(),
        editor = new Editor('value');

    remoteVariable.subscribe(function(changeset) {
        editor.setContent(remoteVariable.getValue());
    });

    editor.subscribe(function(content) {
        remoteVariable.setValue(content);
    });
});
