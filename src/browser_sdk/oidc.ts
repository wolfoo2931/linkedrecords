import {
  UserManager,
  WebStorageStateStore,
  User,
  UserManagerSettings,
} from 'oidc-client-ts';

export interface OIDCConfig {
  client_id: string;
  redirect_uri: string;
  authority?: string; // discovered from server if not provided
  post_logout_redirect_uri?: string;
  scope?: string;
  response_type?: string;
  silent_redirect_uri?: string;
  automaticSilentRenew?: boolean;
}

export class OIDCManager {
  private userManager!: UserManager;

  private user: User | null = null;

  private ready: Promise<void>;

  constructor(config: OIDCConfig, serverURL: URL) {
    this.ready = this.initialize(config, serverURL);
  }

  private async initialize(config: OIDCConfig, serverURL: URL): Promise<void> {
    const {
      authority: providedAuthority,
      client_id: clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: postLogoutRedirectUri,
      scope,
      response_type: responseType,
      silent_redirect_uri: silentRedirectUri,
      automaticSilentRenew,
    } = config;

    let authority = providedAuthority;

    if (!authority) {
      const base = serverURL.toString().replace(/\/$/, '');
      const resp = await fetch(`${base}/oidc/discovery`);
      if (!resp.ok) {
        throw new Error(`Failed to discover OIDC authority: ${resp.status} ${resp.statusText}`);
      }
      const data = await resp.json();
      authority = (data && typeof data.authority === 'string') ? data.authority : undefined;
      if (!authority) {
        throw new Error('OIDC discovery did not return an authority');
      }
    }

    const settings: UserManagerSettings = {
      authority,
      client_id: clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: postLogoutRedirectUri,
      scope: scope || 'openid profile email',
      response_type: responseType || 'code',
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      silent_redirect_uri: silentRedirectUri,
      automaticSilentRenew: automaticSilentRenew ?? true,
      extraQueryParams: {
        audience: serverURL.host,
      },
    };

    this.userManager = new UserManager(settings);
  }

  async login(): Promise<void> {
    await this.ready;
    await this.userManager.signinRedirect();
  }

  async handleRedirectCallback(): Promise<User> {
    await this.ready;
    this.user = await this.userManager.signinRedirectCallback();
    return this.user;
  }

  async logout(): Promise<void> {
    await this.ready;
    await this.userManager.signoutRedirect();
  }

  async getUser(): Promise<User | null> {
    await this.ready;
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
    await this.ready;
    this.user = await this.userManager.signinSilent();
    return this.user;
  }
}
