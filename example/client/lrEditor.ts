import Editor from 'structured-text-editor/src/editor';
import { Changeset } from 'changesets';
import LongTextAttribute from '../../src/attributes/long_text/client';
import KeyValueAttribute from '../../src/attributes/key_value/client';
import KeyValueChange from '../../src/attributes/key_value/key_value_change';
import LongTextChange from '../../src/attributes/long_text/long_text_change';

export default async function(domId: string, contentAttribute: LongTextAttribute, referencesAttribute: KeyValueAttribute) {
  const editor = new Editor(domId);
  editor.setContent(await contentAttribute.getValue());
  editor.addReferenceData(await referencesAttribute.getValue());

  referencesAttribute.subscribe(async (changeset) => {
    const newData = {};

    changeset.change.forEach(({key, value}) => {
      newData[key] = value;
    });

    editor.addReferenceData(newData);
  });

  editor.subscribeReferenceInsertion(async (key, value) => {
    referencesAttribute!.change(new KeyValueChange([{ key, value }]));
  });

  contentAttribute.subscribe(async (changeset, changeInfo) => {
    const attr = { actor: { id: changeInfo.actorId } };

    try {
      editor.applyChangeset(changeset.changeset, attr);
    } catch (ex) {
      console.log('failed to apply changeset to EDITOR content. Falling back to replace the whole editors content', ex);
      editor.setContent(await contentAttribute.getValue(), attr);
    }
  });

  editor.subscribe(async (modificationLog) => {
    if (!modificationLog.actor) {
      try {
        await contentAttribute.change(new LongTextChange(modificationLog.toChangeset(Changeset)));
      } catch (ex) {
        console.log('failed to apply changeset to ATTRIBUTE. Falling back to replace whole attribute content', ex);
        await contentAttribute.set(editor.getOriginalContent());
      }
    }
  });
}