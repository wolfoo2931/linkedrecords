import LinkedRecords from '../../src/browser_sdk';
import { OIDCConfig } from '../../src/browser_sdk/oidc';

// Baked in at build time via webpack's DefinePlugin (see webpack.config.js):
// TESTAPP_AUTH_MODE mirrors the TEST_AUTH_MODE env variable of the test run,
declare const TESTAPP_AUTH_MODE: string;
declare const AUTH_TOKEN_AUDIENCE: string | null;
declare const AUTH_CLIENT_ID: string;
declare const AUTH_ISSUER_BASE_URL: string;

async function init() {
  const lrServerUrl = new URL('http://localhost:3000');
  const config: OIDCConfig | undefined = TESTAPP_AUTH_MODE === 'confidential' ? undefined : {
    authority: AUTH_ISSUER_BASE_URL,
    client_id: AUTH_CLIENT_ID,
    redirect_uri: `${window.location.origin}/callback`,
    audience: AUTH_TOKEN_AUDIENCE || undefined,
    scope: 'openid profile email',
    response_type: 'code',
    useSessionStorage: true,
  };

  const client = new LinkedRecords(lrServerUrl, config, true, true);

  // The constructor already kicks off handleRedirectCallback() in the
  // background when landing back from the IdP with ?code&state (fire-and-
  // forget, since the constructor can't be async). Await the same call here
  // (handleRedirectCallback() is memoized, so this doesn't start a second
  // one) before fetching user info, otherwise ensureUserIdIsKnown() can race
  // ahead and fire without an access token yet.
  const params = new URLSearchParams(window.location.search);
  if (config && params.has('code') && params.has('state')) {
    await client.handleRedirectCallback();
  }

  await client.ensureUserIdIsKnown();

  // when the majority of the test were written
  // the default handler which throws an exception
  // was not implemented yet
  client.setAuthorizationErrorHandler(() => {});
  (window as any).lr = client;
}

init();
