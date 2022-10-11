import { Changeset } from 'changesets';
import Editor from 'structured-text-editor/src/editor';
import LinkedRecords from '../src/browser_sdk/index';
import LongTextChange from '../src/attributes/long_text/long_text_change';
import KeyValueChange from '../src/attributes/key_value/key_value_change';

const stores = {
  'content': 'l-03069649-ae59-4633-a199-c85993010158',
  'reference': 'kv-89193aea-4488-4dd7-a0fc-de80d68f4666',
  'reference_sources': 'kv-0466df56-4e36-4531-8876-600853caffe7'
}

document.addEventListener('DOMContentLoaded', async (event) => {
  const editor = new Editor('value');
  const linkedRecords = new LinkedRecords(new URL('http://localhost:3000'));
  const contentAttribute = await linkedRecords.Attribute.find(stores.content); // await linkedRecords.Attribute.create('longText', '<p>inital</p>');
  const referencesAttribute = await linkedRecords.Attribute.find(stores.reference);

  editor.setContent(await contentAttribute.getValue());
  editor.addReferenceData(await referencesAttribute.getValue());

  // const { content: [ contentAttribute ], refernces: [ referencesAttribute ] } = await linkedRecords.Attribute.findAll({
  //   content: [
  //     ['identifiedBy', 'l-03069649-ae59-4633-a199-c85993010158']
  //   ],
  //   refernces: [
  //     ['isA', 'referenceStore'],
  //     ['belongsTo', 'l-03069649-ae59-4633-a199-c85993010158']
  //   ],
  //   referenceSources: [
  //     ['isA', 'referenceSourceStore'],
  //     ['belongsTo', 'l-03069649-ae59-4633-a199-c85993010158'],
  //     ['belongsTo', 'usr-xx']
  //   ]
  // });

  referencesAttribute.subscribe(async (changeset) => {
    const newData = {};

    changeset.change.forEach(({key, value}) => {
      newData[key] = value;
    });

    editor.addReferenceData(newData);
  });

  editor.subscribeReferenceInsertion(async (key, value) => {
    referencesAttribute.change(new KeyValueChange([{ key, value }]));
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
