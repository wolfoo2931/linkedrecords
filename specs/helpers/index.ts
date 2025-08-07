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

export async function changeUserContext(userId: string) {
  sessionStorage.clear();

  // Make a request to get tokens directly with user_id parameter
  const tokenResponse = await fetch('http://localhost:3002/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'test-code',
      client_id: 'test-client',
      client_secret: 'test-secret',
      redirect_uri: 'http://localhost:9876/callback',
      user_id: userId,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get tokens: ${tokenResponse.status}`);
  }

  const tokens = await tokenResponse.json();

  // Create the user object as oidc-client-ts would store it
  const user = {
    id_token: tokens.id_token,
    access_token: tokens.access_token,
    token_type: tokens.token_type,
    scope: tokens.scope,
    expires_at: Date.now() + (tokens.expires_in * 1000),
    profile: {
      sub: userId,
      email: `${userId}@example.com`,
      email_verified: true,
      name: `Test User ${userId}`,
    },
    state: 'test-state',
    session_state: 'test-session-state',
  };

  // Store the user in session storage as oidc-client-ts would
  // The key format is: oidc.user:{authority}:{client_id}
  sessionStorage.setItem('oidc.user:http://localhost:3002:test-client', JSON.stringify(user));
}

export async function createClient(): Promise<[ LinkedRecords, ClientServerBus ]> {
  await changeUserContext('testuser-1-id');

  // OIDC configuration for tests
  const oidcConfig = {
    authority: 'http://localhost:3002',
    client_id: 'test-client',
    redirect_uri: 'http://localhost:9876/callback',
    scope: 'openid profile email',
    response_type: 'code',
  };

  const client = new LinkedRecords(new URL('http://localhost:3000'), oidcConfig);
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
