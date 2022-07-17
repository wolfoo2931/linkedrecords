import { Changeset } from 'changesets';
import { Attribute } from '../js_sdk/attribute';
import { v4 as uuid } from 'uuid';
import Editor from 'structured-text-editor/src/editor';

var attribute;

document.addEventListener("DOMContentLoaded", async function(event) {
    var clientId = uuid(),
        actorId = clientId,
        attributeId = new URLSearchParams(window.location.search).get('variable-id'),
        editor = new Editor('value'),
        attribute = new Attribute(attributeId, 'http://localhost:3000', clientId, actorId);

    await attribute.load();

    editor.setContent(attribute.get());

    attribute.subscribe(function(changeset, changeInfo) {
        const attr = { actor: { id: changeInfo.actorId } };

        try {
            editor.applyChangeset(changeset, attr);
        } catch(ex) {
            console.log('failed to apply changeset to editors content. Falling back to replace the whole editors content', ex)
            editor.setContent(attribute.get(), attr);
        }
    });

    editor.subscribe(function(modificationLog) {
        if(!modificationLog.actor) {
            try {
                attribute.change(modificationLog.toChangeset(Changeset));
            } catch(ex) {
                console.log('error appling changeseet to remote variable. Falling back to replace whole variable content', ex);
                attribute.set(editor.getOriginalContent());
            }
        }
    });
});
