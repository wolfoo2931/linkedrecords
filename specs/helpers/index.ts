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

export async function changeUserContext(pretendToBe: string) {
  Cookies.remove('pretendToBeUser', { path: '', doamin: 'localhost' });
  Cookies.set('pretendToBeUser', pretendToBe, { path: '', doamin: 'localhost' });
}

export async function createClient(): Promise<[ LinkedRecords, ServerSideEvents ]> {
  const serverSideEvents = new ServerSideEvents();
  const client = new LinkedRecords(new URL('http://localhost:3000'), serverSideEvents);
  await await changeUserContext('testuser-1-id');
  await client.ensureUserIdIsKnown();
  clients.push(client);
  return [client, serverSideEvents];
}

export function cleanupClients() {
  clients.forEach((client) => {
    client.serverSideEvents.unsubscribeAll();
  });

  clients = [];
}

export async function truncateDB() {
  await fetch('http://localhost:3001/deleteFacts');
}
