import LinkedRecords from '../../src/browser_sdk';

async function init() {
  const client = new LinkedRecords(new URL('http://localhost:3000'));
  await client.ensureUserIdIsKnown();

  // when the majority of the test were written
  // the default handler which throws an exception
  // was not implemented yet
  client.setAuthorizationErrorHandler(() => {});
  (window as any).lr = client;
}

init();
