/* eslint-disable no-await-in-loop */
import { expect } from 'chai';
import Session, { InitializedSession } from '../helpers/session';
import { waitFor } from '../../specs/helpers';

describe('query subscriptions', () => {
  beforeEach(Session.truncateDB);
  afterEach(Session.afterEach);
  after(Session.deleteBrowsers);

  // Helper to set up subscription and track callbacks in browser context
  async function setupSubscription(
    client: InitializedSession,
    query: object,
    trackerId: string,
  ): Promise<void> {
    await client.do(async (lr, queryJson, id) => {
      const q = JSON.parse(queryJson);
      (window as any)[`sub_${id}_count`] = 0;
      (window as any)[`sub_${id}_results`] = [];

      (window as any)[`unsub_${id}`] = await lr.Attribute.subscribeToQuery(q, () => {
        lr.Attribute.findAll(q).then((qr) => {
          (window as any)[`sub_${id}_count`] += 1;
          (window as any)[`sub_${id}_results`] = qr;
        });
      });
    }, JSON.stringify(query), trackerId);
  }

  async function getCallCount(client: InitializedSession, trackerId: string): Promise<number> {
    return client.do((lr, id) => (window as any)[`sub_${id}_count`], trackerId);
  }

  async function getJSONResult(
    client: InitializedSession,
    trackerId: string,
  ): Promise<Record<string, any>> {
    return client.do(async (lr, id) => {
      const jsonResult = {};
      const result = (window as any)[`sub_${id}_results`];

      const promises = Object.entries(result).map(async ([group, results]: [string, any]) => {
        jsonResult[group] = await Promise.all(
          results.map((r) => r.getValue()),
        );
      });

      await Promise.all(promises);

      return jsonResult;
    }, trackerId);
  }

  async function unsubscribe(client: InitializedSession, trackerId: string): Promise<void> {
    await client.do((lr, id) => (window as any)[`unsub_${id}`](), trackerId);
  }

  it('notifies subscriber when matching attribute is created', async () => {
    const client = await Session.getOneSession();

    // Declare term first
    await client.Fact.createAll([['Document', '$isATermFor', 'a document type']]);

    // Set up subscription
    await setupSubscription(client, { docs: [['$it', 'isA', 'Document']] }, 'basic');

    // Wait for initial callback (empty results)
    await waitFor(async () => (await getCallCount(client, 'basic')) === 1);
    expect(await getJSONResult(client, 'basic')).to.be.deep.equal({ docs: [] });

    // Create a document
    await client.Attribute.createKeyValue({ name: 'doc1' }, [['$it', 'isA', 'Document']]);

    await waitFor(async () => (await getCallCount(client, 'basic')) === 2);
    expect(await getJSONResult(client, 'basic')).to.be.deep.equal({ docs: [{ name: 'doc1' }] });
  });

  it('does not notify other users when creating private attribute', async () => {
    const [client1, client2] = await Session.getTwoSessions();

    // Declare term (both users can see terms)
    await client1.Fact.createAll([['Document', '$isATermFor', 'a document type']]);

    // Both users subscribe to the same query
    await setupSubscription(client1, { docs: [['$it', 'isA', 'Document']] }, 'user1');
    await setupSubscription(client2, { docs: [['$it', 'isA', 'Document']] }, 'user2');

    // Wait for initial callbacks
    await waitFor(async () => (await getCallCount(client1, 'user1')) === 1);
    await waitFor(async () => (await getCallCount(client2, 'user2')) === 1);
    expect(await getJSONResult(client1, 'user1')).to.deep.equal({ docs: [] });
    expect(await getJSONResult(client2, 'user2')).to.deep.equal({ docs: [] });

    // Client1 creates a private document
    await client1.Attribute.createKeyValue({ name: 'private-doc' }, [['$it', 'isA', 'Document']]);

    // Client1 should be notified
    await waitFor(async () => (await getCallCount(client1, 'user1')) === 2);
    expect(await getJSONResult(client1, 'user1')).to.deep.equal({ docs: [{ name: 'private-doc' }] });

    // Client2 should NOT be notified (FactBox isolation)
    // Wait a bit to ensure no notification comes
    await browser.pause(300);
    expect(await getCallCount(client2, 'user2')).to.equal(1);
    expect(await getJSONResult(client2, 'user2')).to.deep.equal({ docs: [] });
  });

  it('notifies team members when shared attribute is created', async () => {
    const [client1, client2] = await Session.getTwoSessions();

    // Declare terms
    await client1.Fact.createAll([
      ['Document', '$isATermFor', 'a document type'],
      ['Team', '$isATermFor', 'a team type'],
    ]);

    // Client1 creates a team
    const team = await client1.Attribute.createKeyValue(
      { name: 'shared-team' },
      [['$it', 'isA', 'Team']],
    );

    // Client1 invites Client2 to the team
    const client2Id = await client1.getUserIdByEmail(client2.email);
    await client1.Fact.createAll([[client2Id, '$isMemberOf', team.id]]);

    // Client2 subscribes to documents
    await setupSubscription(client2, { docs: [['$it', 'isA', 'Document']] }, 'shared');

    // Wait for initial callback
    await waitFor(async () => (await getCallCount(client2, 'shared')) === 1);
    expect(await getJSONResult(client2, 'shared')).to.deep.equal({ docs: [] });

    // Client1 creates a document shared with the team
    await client1.Attribute.createKeyValue(
      { name: 'shared-doc' },
      [
        ['$it', 'isA', 'Document'],
        [team.id!, '$canAccess', '$it'],
      ],
    );

    // Client2 should be notified because they're a team member
    await waitFor(async () => (await getCallCount(client2, 'shared')) === 2);
    expect(await getJSONResult(client2, 'shared')).to.deep.equal({ docs: [{ name: 'shared-doc' }] });
  });

  it('does not notify for facts with predicates not in query', async () => {
    const client = await Session.getOneSession();

    // Declare terms
    await client.Fact.createAll([
      ['Document', '$isATermFor', 'a document type'],
      ['ArchivedState', '$isATermFor', 'an archived state'],
    ]);

    // Subscribe to query that only uses 'isA' predicate
    await setupSubscription(client, { docs: [['$it', 'isA', 'Document']] }, 'predicate');

    // Wait for initial callback
    await waitFor(async () => (await getCallCount(client, 'predicate')) === 1);
    expect(await getJSONResult(client, 'predicate')).to.deep.equal({ docs: [] });

    // Create a document (should trigger notification)
    const doc = await client.Attribute.createKeyValue(
      { name: 'doc' },
      [['$it', 'isA', 'Document']],
    );

    await waitFor(async () => (await getCallCount(client, 'predicate')) === 2);
    expect(await getJSONResult(client, 'predicate')).to.deep.equal({ docs: [{ name: 'doc' }] });

    // Create a state and add stateIs fact (should NOT trigger notification)
    const archivedState = await client.Attribute.createKeyValue(
      {},
      [['$it', 'isA', 'ArchivedState']],
    );

    await waitFor(async () => (await getCallCount(client, 'predicate')) === 3);

    // This fact uses 'stateIs' predicate which is not in the subscription query
    await client.Fact.createAll([[doc.id!, 'stateIs', archivedState.id!]]);

    // Wait a bit to ensure no notification comes
    await browser.pause(300);

    // Should still be 3 - the stateIs fact shouldn't trigger notification
    expect(await getCallCount(client, 'predicate')).to.equal(3);
  });

  it('does not notify after unsubscribe', async () => {
    const client = await Session.getOneSession();

    // Declare term
    await client.Fact.createAll([['Document', '$isATermFor', 'a document type']]);

    // Subscribe
    await setupSubscription(client, { docs: [['$it', 'isA', 'Document']] }, 'unsub');

    // Wait for initial callback
    await waitFor(async () => (await getCallCount(client, 'unsub')) === 1);
    expect(await getJSONResult(client, 'unsub')).to.deep.equal({ docs: [] });

    // Create first document (should notify)
    await client.Attribute.createKeyValue({ name: 'doc1' }, [['$it', 'isA', 'Document']]);
    await waitFor(async () => (await getCallCount(client, 'unsub')) === 2);
    expect(await getJSONResult(client, 'unsub')).to.deep.equal({ docs: [{ name: 'doc1' }] });

    // Unsubscribe
    await unsubscribe(client, 'unsub');

    // Create second document (should NOT notify)
    await client.Attribute.createKeyValue({ name: 'doc2' }, [['$it', 'isA', 'Document']]);

    // Wait a bit to ensure no notification comes
    await browser.pause(300);

    // Count should still be 2
    expect(await getCallCount(client, 'unsub')).to.equal(2);
  });

  it('notifies when facts matching query predicates are deleted', async () => {
    const client = await Session.getOneSession();

    // Declare terms
    await client.Fact.createAll([
      ['Document', '$isATermFor', 'a document type'],
      ['ActiveState', '$isATermFor', 'an active state'],
    ]);

    // Create document and state
    const doc = await client.Attribute.createKeyValue(
      { name: 'doc' },
      [['$it', 'isA', 'Document']],
    );
    const activeState = await client.Attribute.createKeyValue(
      {},
      [['$it', 'isA', 'ActiveState']],
    );

    // Add stateIs fact
    await client.Fact.createAll([[doc.id!, 'stateIs', activeState.id!]]);

    // Subscribe to query that includes stateIs predicate
    await setupSubscription(
      client,
      { docs: [['$it', 'isA', 'Document'], ['$it', 'stateIs', activeState.id!]] },
      'deletion',
    );

    // Wait for initial callback
    await waitFor(async () => (await getCallCount(client, 'deletion')) === 1);
    expect(await getJSONResult(client, 'deletion')).to.deep.equal({ docs: [{ name: 'doc' }] });

    // Delete the stateIs fact
    await client.Fact.deleteAll([[doc.id!, 'stateIs', activeState.id!]]);

    // Should be notified of the deletion
    await waitFor(async () => (await getCallCount(client, 'deletion')) === 2);
    // After deletion, the doc no longer matches the query (stateIs fact is gone)
    expect(await getJSONResult(client, 'deletion')).to.deep.equal({ docs: [] });
  });

  it('stops notifying user after removal from team', async () => {
    const [client1, client2, unrelatedClient] = await Session.getThreeSessions();

    // Declare terms
    await client1.Fact.createAll([
      ['Document', '$isATermFor', 'a document type'],
      ['Team', '$isATermFor', 'a team type'],
    ]);

    // Client1 creates a team
    const team = await client1.Attribute.createKeyValue(
      { name: 'team' },
      [['$it', 'isA', 'Team']],
    );

    // Client1 invites Client2 to the team
    const client2Id = await client1.getUserIdByEmail(client2.email);
    await client1.Fact.createAll([[client2Id, '$isMemberOf', team.id]]);

    // Client2 subscribes to documents
    await setupSubscription(client2, { docs: [['$it', 'isA', 'Document']] }, 'removal');
    await setupSubscription(unrelatedClient, { docs: [['$it', 'isA', 'Document']] }, 'removal');

    // Wait for initial callback
    await waitFor(async () => (await getCallCount(client2, 'removal')) === 1);
    await waitFor(async () => (await getCallCount(unrelatedClient, 'removal')) === 1);
    expect(await getJSONResult(client2, 'removal')).to.deep.equal({ docs: [] });
    expect(await getJSONResult(unrelatedClient, 'removal')).to.deep.equal({ docs: [] });

    // Client1 creates a shared document (should notify client2)
    await client1.Attribute.createKeyValue(
      { name: 'doc1' },
      [['$it', 'isA', 'Document'], [team.id!, '$canAccess', '$it']],
    );
    await waitFor(async () => (await getCallCount(client2, 'removal')) === 2);
    expect(await getJSONResult(client2, 'removal')).to.deep.equal({ docs: [{ name: 'doc1' }] });

    // wait a little to make sure everything is propagated and make sure unrelatedClient
    // does not see the teams docs
    await browser.pause(300);
    expect(await getJSONResult(unrelatedClient, 'removal')).to.deep.equal({ docs: [] });

    // Remove Client2 from team
    await client1.Fact.deleteAll([[client2Id, '$isMemberOf', team.id!]]);

    // Wait a bit for membership removal to propagate
    await browser.pause(300);

    // Client1 creates another shared document (should NOT notify client2)
    await client1.Attribute.createKeyValue(
      { name: 'doc2' },
      [['$it', 'isA', 'Document'], [team.id!, '$canAccess', '$it']],
    );

    // Wait a bit to ensure no notification comes
    await browser.pause(300);

    // Client2 should not receive notification for doc2
    // As we do not have access to the team anymore, we will not see any docs anymore
    expect(await getJSONResult(client2, 'removal')).to.deep.equal({ docs: [] });
    expect(await getJSONResult(unrelatedClient, 'removal')).to.deep.equal({ docs: [] });
  });

  it('handles multiple concurrent subscriptions correctly', async () => {
    const client = await Session.getOneSession();

    // Declare terms
    await client.Fact.createAll([
      ['Document', '$isATermFor', 'a document type'],
      ['Task', '$isATermFor', 'a task type'],
    ]);

    // Subscribe to documents
    await setupSubscription(client, { items: [['$it', 'isA', 'Document']] }, 'docs');

    // Subscribe to tasks
    await setupSubscription(client, { items: [['$it', 'isA', 'Task']] }, 'tasks');

    // Wait for initial callbacks
    await waitFor(async () => (await getCallCount(client, 'docs')) === 1);
    await waitFor(async () => (await getCallCount(client, 'tasks')) === 1);
    expect(await getJSONResult(client, 'docs')).to.deep.equal({ items: [] });
    expect(await getJSONResult(client, 'tasks')).to.deep.equal({ items: [] });

    // Create a document
    await client.Attribute.createKeyValue({ name: 'doc1' }, [['$it', 'isA', 'Document']]);
    await client.Attribute.createKeyValue({ name: 'task1' }, [['$it', 'isA', 'Task']]);

    await waitFor(async () => (await getCallCount(client, 'docs')) === 3);
    expect(await getJSONResult(client, 'docs')).to.deep.equal({ items: [{ name: 'doc1' }] });
    expect(await getJSONResult(client, 'tasks')).to.deep.equal({ items: [{ name: 'task1' }] });
  });
});
