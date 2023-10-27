import { expect } from 'chai';
import Session from '../helpers/session';

describe('authorization', () => {
  it('does not allow to read attributes create by other users', async () => {
    const [user1, user2] = await Session.getTwoSessions();

    const authorizedReadAttributeId = await user1.Attribute.create('keyValue', { foo: 'bar-u1' });

    await user1.Attribute.expectToFind(authorizedReadAttributeId);
    await user2.Attribute.expectNotToFind(authorizedReadAttributeId);

    let authorizedValue = await user1.Attribute.findAndGetValue(authorizedReadAttributeId);
    expect(authorizedValue).to.eql({ foo: 'bar-u1' });

    const unauthorizedValue = await user2.Attribute.findAndGetValue(authorizedReadAttributeId);
    expect(unauthorizedValue).to.eql(null);

    await user1.Attribute.findAndSetValue(authorizedReadAttributeId, { foo: 'authorized' });

    authorizedValue = await user1.Attribute.findAndGetValue(authorizedReadAttributeId);
    expect(authorizedValue).to.eql({ foo: 'authorized' });

    // const unauthorizedReadAttributeId = await user2.do(async (lr, attrId) => {
    //   const unauthorizedReadAttribute = await lr.Attribute.find(attrId);
    //   return unauthorizedReadAttribute?.id;
    // }, attributeId);
  });
});
