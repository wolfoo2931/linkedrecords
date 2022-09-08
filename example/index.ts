import { Changeset } from 'changesets';
import { LongTextAttribute } from '../src/attributes/long_text/client';
import { LinkedRecords } from '../src/browser_sdk/index';
import Editor from 'structured-text-editor/src/editor';

document.addEventListener("DOMContentLoaded", async event => {
    const attributeId = new URLSearchParams(window.location.search).get('variable-id') || '';
    const editor = new Editor('value');
    const linkedRecords = new LinkedRecords(new URL('http://localhost:3000'));
    const attribute = new LongTextAttribute(attributeId, linkedRecords);
    const intialValue = await attribute.get();

    editor.setContent(intialValue.value);

    attribute.subscribe(async (changeset, changeInfo) => {
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
                const attrState = await attribute.get();
                editor.setContent(attrState.value);

                console.log('error appling changeseet to remote attribute. Falling back to replace whole attribute content', ex);
            }
        }
    });
});
