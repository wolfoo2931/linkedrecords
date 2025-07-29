import {
  UserManager,
  WebStorageStateStore,
  User,
  UserManagerSettings,
} from 'oidc-client-ts';

export interface OIDCConfig {
  authority: string;
  client_id: string;
  redirect_uri: string;
  post_logout_redirect_uri?: string;
  scope?: string;
  response_type?: string;
  silent_redirect_uri?: string;
  automaticSilentRenew?: boolean;
}

export class OIDCManager {
  private userManager: UserManager;

  private user: User | null = null;

  constructor(config: OIDCConfig) {
    const settings: UserManagerSettings = {
      authority: config.authority,
      client_id: config.client_id,
      redirect_uri: config.redirect_uri,
      post_logout_redirect_uri: config.post_logout_redirect_uri,
      scope: config.scope || 'openid profile email',
      response_type: config.response_type || 'code',
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      silent_redirect_uri: config.silent_redirect_uri,
      automaticSilentRenew: config.automaticSilentRenew ?? true,
    };

    this.userManager = new UserManager(settings);
  }

  async login(): Promise<void> {
    await this.userManager.signinRedirect();
  }

  async handleRedirectCallback(): Promise<User> {
    console.log('handling it OIDC callback');
    this.user = await this.userManager.signinRedirectCallback();
    return this.user;
  }

  async logout(): Promise<void> {
    await this.userManager.signoutRedirect();
  }

  async getUser(): Promise<User | null> {
    if (!this.user) {
      this.user = await this.userManager.getUser();
    }
    return this.user;
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getUser();
    return !!user && !user.expired;
  }

  async getAccessToken(): Promise<string | null> {
    const user = await this.getUser();
    return user && !user.expired ? user.access_token : null;
  }

  async signinSilent(): Promise<User | null> {
    this.user = await this.userManager.signinSilent();
    return this.user;
  }
}
