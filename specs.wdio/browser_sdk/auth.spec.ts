import Session from '../helpers/session';

describe('authorization', () => {
  it('works', async () => {
    const [user1, user2] = await Session.getTwoSessions();

    const attributeId = await user1.do(async (lr) => {
      const attribute = await lr.Attribute.create('keyValue', { foo: 'bar' });
      const foundAttribute = await lr.Attribute.find(attribute.id!);
      return foundAttribute.id;
    });

    console.log(user2);

    // const unauthorizedReadAttributeId = await user2.do(async (lr, attrId) => {
    //   const unauthorizedReadAttribute = await lr.Attribute.find(attrId);
    //   return unauthorizedReadAttribute?.id;
    // }, attributeId);

    expect(attributeId.length).toBe(39);
  });
});
