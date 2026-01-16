export interface DevUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export const DEV_USERS: DevUser[] = [
  { sub: 'alice-user-id-001', email: 'alice@example.com', name: 'Alice' },
  { sub: 'bob-user-id-002', email: 'bob@example.com', name: 'Bob' },
  { sub: 'charlie-user-id-003', email: 'charlie@example.com', name: 'Charlie' },
];

export function getIssuerUrl(): string {
  const baseUrl = process.env['SERVER_BASE_URL'] || 'http://localhost:6543';
  return `${baseUrl}/dev-oidc`;
}

export function getClientId(): string {
  return process.env['AUTH_CLIENT_ID'] || 'linkedrecords-dev';
}

export function getAudience(): string {
  return process.env['AUTH_TOKEN_AUDIENCE'] || 'linkedrecords-dev';
}

export const TOKEN_EXPIRY = 24 * 60 * 60; // 24 hours in seconds
export const CODE_EXPIRY = 60 * 1000; // 60 seconds in milliseconds
