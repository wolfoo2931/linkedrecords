import { Changeset } from 'changesets';
import { LongTextAttribute } from '../src/attributes/long_text_attribute/client';
import { v4 as uuid } from 'uuid';
import Editor from 'structured-text-editor/src/editor';

var attribute;

document.addEventListener("DOMContentLoaded", async event => {
    const clientId = uuid();
    const actorId = clientId;
    const attributeId = new URLSearchParams(window.location.search).get('variable-id') || '';
    const editor = new Editor('value');
    const attribute = new LongTextAttribute(attributeId, clientId, actorId, 'http://localhost:3000');
    const intialValue = await attribute.get();

    editor.setContent(intialValue.value);

    attribute.subscribe(async (changeset, changeInfo) => {
        console.log('changeInfo:', changeInfo)
        const attr = { actor: { id: changeInfo.actorId } };
        const attrState = await attribute.get();

        try {
            editor.applyChangeset(changeset, attr);
        } catch(ex) {
            console.log('failed to apply changeset to editors content. Falling back to replace the whole editors content', ex)
            editor.setContent(attrState.value, attr);
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
