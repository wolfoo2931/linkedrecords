var RemoteVariable = require('../js_sdk/remote_variable'),
    UUID = require('../js_sdk/uuid'),
    Caret = require('../js_sdk/caret'),
    $ = require('jquery');

$().ready(function() {
    var clientId = actorId = (new UUID()).getValue(),
        variableId = new URLSearchParams(window.location.search).get('variable-id'),
        remoteVariable = new RemoteVariable(variableId, 'http://localhost:3000', clientId, actorId).load(),
        caret = new Caret();

    remoteVariable.subscribe(function(changeset) {
        var contentElement = document.getElementById('value');

        caret.saveSelection(contentElement);
        contentElement.innerHTML = remoteVariable.getValue();
        caret.restoreSelection(contentElement);
    });

    $('#value').on('input', function() {
      remoteVariable.setValue($('#value').html());
    });
});
