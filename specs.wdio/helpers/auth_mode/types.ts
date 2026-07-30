// An AuthModeStrategy encapsulates HOW the test application authenticates
// against the LinkedRecords server — independent of WHICH OIDC provider is
// used (that is the IdpAdapter's job, see ../idp/types.ts).
//
// The login sequence driven by Session.getSession is:
//   1. browser loads the test app
//   2. strategy.initiateLogin(browser)  → browser ends up on the IdP's login page
//   3. idp.login(browser, email, pwd)   → IdP redirects back to the app
//   4. strategy.completeLogin(browser)  → app is authenticated, window.lr usable
//
// Implemented modes:
//   - confidential: cookie-based server-side session (express-openid-connect);
//     the test app's /login, /callback and /logout routes are proxied to the
//     LinkedRecords server (see the static-server middleware in wdio.conf.ts).
//
// A future 'public' mode (SDK public-client / bearer tokens) plugs in here:
//   initiateLogin calls window.lr.login() on a client built via
//   getPublicClient(), completeLogin waits for the SDK to process the
//   redirect callback and hold an access token. It additionally needs the
//   server started with ALLOW_HTTP_AUTHENTICATION_HEADER and a matching
//   AUTH_TOKEN_AUDIENCE, and the test app to construct a public client.
//
// Adding a mode = implement this interface and register it in ./index.ts;
// it is selected at runtime via the TEST_AUTH_MODE environment variable.
export default interface AuthModeStrategy {
  // Bring the browser from the freshly loaded test app to the IdP's login page.
  initiateLogin(browser: WebdriverIO.Browser): Promise<void>;

  // Called after the IdP has redirected back to the application; must resolve
  // once the application session is established.
  completeLogin(browser: WebdriverIO.Browser): Promise<void>;
}
