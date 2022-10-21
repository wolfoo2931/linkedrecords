import LinkedRecords from '../../src/browser_sdk/index';
import LongTextAttribute from '../../src/attributes/long_text/client';
import KeyValueAttribute from '../../src/attributes/key_value/client';
import lrEditor from './lrEditor';

document.addEventListener('DOMContentLoaded', async (event) => {
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

  lrEditor('value', contentAttribute, referencesAttribute);
});
