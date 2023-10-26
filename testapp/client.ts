import LinkedRecords from '../src/browser_sdk';

async function init() {
  const client = new LinkedRecords(new URL('http://localhost:3000'));
  await client.ensureUserIdIsKnown();
  (window as any).lr = client;
}

init();
