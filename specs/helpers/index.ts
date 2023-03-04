import Cookies from 'js-cookie';
import LinkedRecords from '../../src/browser_sdk';
import ServerSideEvents from '../../lib/server-side-events/client';

let clients: LinkedRecords[] = [];

export const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

// eslint-disable-next-line import/prefer-default-export
export function waitFor(fn) {
  return new Promise<void>((resolve) => {
    const intervallId = setInterval(async () => {
      const result = await fn();

      if (result) {
        clearInterval(intervallId);
        resolve();
      }
    }, 100);
  });
}

export async function createClient(pretendToBe: string = 'testuser-1-id'): Promise<[ LinkedRecords, ServerSideEvents ]> {
  const serverSideEvents = new ServerSideEvents();
  Cookies.set('pretendToBeUser', pretendToBe);
  const client = new LinkedRecords(new URL('http://localhost:3000'), serverSideEvents);
  await client.ensureUserIdIsKnown();

  const proxiedCliend = new Proxy(client, {
    get(target, prop, receiver) {
      Cookies.set('pretendToBeUser', pretendToBe);
      return Reflect.get(...arguments);
    },
  });

  clients.push(proxiedCliend);
  return [proxiedCliend, serverSideEvents];
}

export function cleanupClients() {
  clients.forEach((client) => {
    client.serverSideEvents.unsubscribeAll();
  });

  clients = [];
}

export async function truncateDB() {
  const [client] = await createClient();
  await client.Fact.deleteAll();

  clients.push(client);
}