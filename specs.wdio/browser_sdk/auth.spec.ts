import { expect } from 'chai';
import Session from '../helpers/session';
import WdioRemote from '../helpers/wdio_remote';

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
  });

  it.only('do', async () => {
    const user1 = await Session.getOneSession();
    const remote = new WdioRemote(user1.browser);

    const attribute = await remote.execute(async () => {
      const { lr } = window as any;
      return lr.Attribute.create('keyValue', { foo: 'bar-u1' });
    });

    console.log(await attribute.getValue());
    await attribute.set({ remote: 'update' });
    console.log(await attribute.getValue());
  });
});
