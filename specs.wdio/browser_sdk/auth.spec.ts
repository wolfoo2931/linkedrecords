import { expect } from 'chai';
import Session from '../helpers/session';

describe('authorization', () => {
  beforeEach(Session.truncateDB);

  it.only('does not allow to read attributes create by other users', async () => {
    const [client1, client2] = await Session.getTwoSessions();

    const attribute = await client1.Attribute.create('keyValue', { foo: 'bar' });
    const authorizedReadAttribute = await client1.Attribute.find(await attribute.getId());

    const unauthorizedReadAttribute = await client2.Attribute.find(await attribute.getId());

    expect(await unauthorizedReadAttribute).to.eql(null);

    expect(await authorizedReadAttribute!.getValue()).to.eql({ foo: 'bar' });

    await authorizedReadAttribute!.set({ foo: 'authorized' });

    expect(await authorizedReadAttribute!.getValue()).to.eql({ foo: 'authorized' });

    expect(unauthorizedReadAttribute).to.eql(null);

    const authorizedCompound = await client1.Attribute.findAll({ doc: await attribute.getId() });

    const unauthorizedCompound = await client2.Attribute.findAll({
      doc: await attribute.getId(),
    });

    expect(unauthorizedCompound).to.eql({});

    expect(await authorizedCompound.doc.getValue()).to.eql({ foo: 'authorized' });
  });
});
