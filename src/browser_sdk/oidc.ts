import {
  UserManager,
  WebStorageStateStore,
  User,
  UserManagerSettings,
} from 'oidc-client-ts';

export interface OIDCConfig {
  client_id?: string;
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

  private redirectOriginPath?: string;

  constructor(config: OIDCConfig, serverURL: URL) {
    const {
      redirect_uri: redirectUri,
    } = config;

    this.ready = this.initialize(config, serverURL);

    try {
      const ru = new URL(redirectUri);
      this.redirectOriginPath = `${ru.origin}${ru.pathname}`;
    } catch (_) {
      throw new Error(`Invalid redirect URI ${redirectUri}`);
    }
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
    let clientIdToUse = clientId;

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

      if (!clientIdToUse) {
        clientIdToUse = data.client_id;
      }
    }

    if (!clientIdToUse) {
      throw new Error('OIDC discovery did not return an clientId, you need to provide one when initializing LinkedRecords');
    }

    const settings: UserManagerSettings = {
      authority,
      client_id: clientIdToUse,
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
    if (await this.isOnRedirectUriRoute()) {
      return;
    }

    const returnTo = window.location.pathname + window.location.search + window.location.hash;
    window.sessionStorage.setItem('lr_return_to', returnTo);

    await this.userManager.signinRedirect();
  }

  async handleRedirectCallback(): Promise<User> {
    await this.ready;
    this.user = await this.userManager.signinRedirectCallback();

    const returnTo = window.sessionStorage.getItem('lr_return_to');
    window.sessionStorage.removeItem('lr_return_to');

    if (returnTo && typeof returnTo === 'string') {
      window.location.href = returnTo;
    }

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

  async isOnRedirectUriRoute(): Promise<boolean> {
    const currentOriginPath = `${window.location.origin}${window.location.pathname}`;
    return currentOriginPath === this.redirectOriginPath;
  }
}
