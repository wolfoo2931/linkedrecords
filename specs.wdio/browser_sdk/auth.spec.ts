import Session from '../helpers/session';

describe('authorization', () => {
  it('works', async () => {
    const user1 = await Session.getOneSession();

    const attributeId = await user1.Attribute.create('keyValue', { foo: 'bar' });

    // const unauthorizedReadAttributeId = await user2.do(async (lr, attrId) => {
    //   const unauthorizedReadAttribute = await lr.Attribute.find(attrId);
    //   return unauthorizedReadAttribute?.id;
    // }, attributeId);

    expect(attributeId.length).toBe(39);
  });
});
