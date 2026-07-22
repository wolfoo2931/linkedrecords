import LinkedRecords from '../../src/browser_sdk';

// Baked in at build time via webpack's DefinePlugin (see webpack.config.js):
// TESTAPP_AUTH_MODE mirrors the TEST_AUTH_MODE env variable of the test run,
declare const TESTAPP_AUTH_MODE: string;
declare const AUTH_TOKEN_AUDIENCE: string | null;
declare const AUTH_CLIENT_ID: string;
declare const AUTH_ISSUER_BASE_URL: string;

async function init() {
  let client: LinkedRecords;

  if (TESTAPP_AUTH_MODE === 'public') {
    client = new LinkedRecords(
      new URL('http://localhost:3000'),
      {
        authority: AUTH_ISSUER_BASE_URL,
        client_id: AUTH_CLIENT_ID,
        redirect_uri: `${window.location.origin}/callback`,
        audience: AUTH_TOKEN_AUDIENCE || undefined,
        scope: 'openid profile email',
        response_type: 'code',
        useSessionStorage: true,
      },
    );
  } else {
    client = new LinkedRecords(new URL('http://localhost:3000'));
    await client.ensureUserIdIsKnown();
  }

  // when the majority of the test were written
  // the default handler which throws an exception
  // was not implemented yet
  client.setAuthorizationErrorHandler(() => {});
  (window as any).lr = client;
}

init();
