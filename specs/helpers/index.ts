import Cookies from 'js-cookie';
import LinkedRecords from '../../src/browser_sdk';
import ClientServerBus from '../../lib/client-server-bus/client';

let clients: LinkedRecords[] = [];

export const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

// eslint-disable-next-line import/prefer-default-export
export function waitFor(fn) {
  return new Promise<void>((resolve) => {
    const intervalId = setInterval(async () => {
      const result = await fn();

      if (result) {
        clearInterval(intervalId);
        resolve();
      }
    }, 100);
  });
}

export async function changeUserContext(pretendToBe: string) {
  Cookies.remove('pretendToBeUser', { path: '', doamin: 'localhost' });
  Cookies.set('pretendToBeUser', pretendToBe, { path: '', doamin: 'localhost' });
}

export async function createClient(): Promise<[ LinkedRecords, ClientServerBus ]> {
  await changeUserContext('testuser-1-id');
  const client = new LinkedRecords(new URL('http://localhost:3000'));
  await client.ensureUserIdIsKnown();
  clients.push(client);
  await new Promise((r) => { setTimeout(r, 100); });
  const csb = await client.getClientServerBus();
  return [client, csb];
}

export function cleanupClients() {
  clients.forEach((client) => {
    client.getClientServerBus().then((csb) => {
      csb.unsubscribeAll();
    });
  });

  clients = [];
}

export async function truncateDB() {
  await fetch('http://localhost:3001/deleteFacts');
}
