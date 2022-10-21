import { Changeset } from 'changesets';
import Editor from 'structured-text-editor/src/editor';
import LinkedRecords from '../../src/browser_sdk/index';
import LongTextChange from '../../src/attributes/long_text/long_text_change';
import KeyValueChange from '../../src/attributes/key_value/key_value_change';
import LongTextAttribute from '../../src/attributes/long_text/client';
import KeyValueAttribute from '../../src/attributes/key_value/client';

document.addEventListener('DOMContentLoaded', async (event) => {
  const editor = new Editor('value');
  const linkedRecords = new LinkedRecords(new URL('http://10.60.3.218:3000'));

  // const content = await linkedRecords.Attribute.create('longText', 'inital');
  // console.log('New ContentId', content.id);
  // const contentId = content.id;

  const contentId = 'l-39d5ab07-b571-4d3b-abf0-2a5974fe41df';

  let { content: contentAttribute, refernces: [ referencesAttribute ] } = <{
    content: LongTextAttribute,
    refernces: KeyValueAttribute[],
    referenceSources: KeyValueAttribute[]
  }> <unknown> await linkedRecords.Attribute.findAll({
    content: contentId,
    refernces: [
      ['isA', 'referenceStore'],
      ['belongsTo', contentId],
    ],
    referenceSources: [
      ['isA', 'referenceSourceStore'],
      ['belongsTo', contentId],
      ['belongsTo', 'usr-xx'],
    ]
  });

  if (!referencesAttribute) {
    referencesAttribute = await linkedRecords.Attribute.create('keyValue', {}) as KeyValueAttribute;
    await linkedRecords.Fact.createAll([
      [referencesAttribute.id, 'isA', 'referenceStore'],
      [referencesAttribute.id, 'belongsTo', contentId]
    ]);
  }

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
});
