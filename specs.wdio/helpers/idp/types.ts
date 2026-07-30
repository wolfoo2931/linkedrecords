// An IdpAdapter encapsulates all interaction with an OIDC provider's hosted
// login UI. It is handed a browser that is already ON the provider's login
// page (the auth mode strategy is responsible for getting it there) and must
// leave the browser submitted past the provider's screens (credentials and,
// if shown, consent) so the provider redirects back to the application.
//
// Adding a provider = implement this interface and register it in ./index.ts;
// it is selected at runtime via the TEST_IDP environment variable.
export default interface IdpAdapter {
  login(browser: WebdriverIO.Browser, email: string, password: string): Promise<void>;
}
