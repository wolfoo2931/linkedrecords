import { Changeset } from 'changesets';
import { Attribute } from '../js_sdk/attribute';
import { v4 as uuid } from 'uuid';
import Editor from 'structured-text-editor/src/editor';

var attribute;

document.addEventListener("DOMContentLoaded", async event => {
    var clientId = uuid(),
        actorId = clientId,
        attributeId = new URLSearchParams(window.location.search).get('variable-id'),
        editor = new Editor('value'),
        attribute = new Attribute(attributeId, clientId, actorId, 'http://localhost:3000');

    editor.setContent(await attribute.get());

    await attribute.subscribe(async (changeset, changeInfo) => {
        console.log('changeInfo:', changeInfo)
        const attr = { actor: { id: changeInfo.actorId } };

        try {
            editor.applyChangeset(changeset, attr);
        } catch(ex) {
            console.log('failed to apply changeset to editors content. Falling back to replace the whole editors content', ex)
            editor.setContent(await attribute.get(), attr);
        }
    });

    editor.subscribe(async modificationLog => {
        if(!modificationLog.actor) {
            try {
                await attribute.change(modificationLog.toChangeset(Changeset));
            } catch(ex) {
                console.log('error appling changeseet to remote attribute. Falling back to replace whole attribute content', ex);
                await attribute.set(editor.getOriginalContent());
            }
        }
    });
});
