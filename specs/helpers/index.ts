import Cookies from 'js-cookie';
import LinkedRecords from '../../src/browser_sdk';
import ClientServerBus from '../../lib/client-server-bus/client';

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
  Cookies.remove('userId', { path: '', doamin: 'localhost' });
  Cookies.remove('pretendToBeUser', { path: '', doamin: 'localhost' });
  Cookies.set('pretendToBeUser', pretendToBe, { path: '', doamin: 'localhost' });
}

export async function createClient(): Promise<[ LinkedRecords, ClientServerBus ]> {
  const clientServerBus = new ClientServerBus();
  const client = new LinkedRecords(new URL('http://localhost:3000'), clientServerBus);
  await changeUserContext('testuser-1-id');
  await client.ensureUserIdIsKnown();
  clients.push(client);
  return [client, clientServerBus];
}

export function cleanupClients() {
  clients.forEach((client) => {
    client.clientServerBus.unsubscribeAll();
  });

  clients = [];
}

export async function truncateDB() {
  await fetch('http://localhost:3001/deleteFacts');
}
