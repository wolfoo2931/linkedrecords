/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-cycle */

import { uuidv7 as uuid } from 'uuidv7';

import LongTextAttribute from '../attributes/long_text/client';
import KeyValueAttribute from '../attributes/key_value/client';
import KeyValueChange from '../attributes/key_value/key_value_change';
import LongTextChange from '../attributes/long_text/long_text_change';
import ClientServerBus from '../../lib/client-server-bus/client';
import FactsRepository from './facts_repository';
import AttributesRepository from './attributes_repository';
import { QuotaAsJSON } from '../server/quota';
import { OIDCManager, OIDCConfig } from './oidc';

type FetchOptions = {
  headers?: object | undefined,
  method?: string,
  body?: any,
  isJSON?: boolean,
  doNotHandleExpiredSessions?: boolean,
  skipWaitForUserId?: boolean,
};

export {
  LongTextAttribute,
  KeyValueAttribute,
  KeyValueChange,
  LongTextChange,
};

const publicClients: Record<string, LinkedRecords> = {};

export default class LinkedRecords {
  static ensureUserIdIsKnownPromise;

  KeyValueChange: typeof KeyValueChange = KeyValueChange;

  private clientServerBus: ClientServerBus;

  serverURL: URL;

  loginHandler?: () => void;

  connectionLostHandler?: (err?) => void;

  unknownServerErrorHandler?: (response) => void;

  quotaViolationErrorHandler?: (response) => void;

  attributeClientIdSuffix: number = 0;

  clientId: string;

  actorId: string | undefined;

  Attribute: AttributesRepository;

  Fact: FactsRepository;

  private oidcManager?: OIDCManager;

  private qetQuotaPromise: Record<string, Promise<any | undefined>> = {};

  static getPublicClient(url: string): LinkedRecords {
    const normalizedUrl = new URL(url).toString().replace(/\/$/, '');
    const cached = publicClients[normalizedUrl];
    if (cached !== undefined) {
      return cached;
    }

    const oidcConfig = {
      redirect_uri: `${window.location.origin}/callback`,
    };

    const linkedRecords: LinkedRecords = new LinkedRecords(new URL(url), oidcConfig);

    linkedRecords.setConnectionLostHandler((error: any) => {
      console.error('linkedRecords connection lost error:', error);
    });

    linkedRecords.setUnknownServerErrorHandler(() => {
      console.error('server error');
    });

    linkedRecords.setLoginHandler(() => {
      const needsVerification = window.location.search.includes('email-not-verified');

      if (needsVerification) {
        console.log('the user must verify its email address.');
      }

      console.log('login required, set a login handler which prompts the user to login via linkedRecords.setLoginHandler');
    });

    publicClients[normalizedUrl] = linkedRecords;
    return linkedRecords;
  }

  constructor(
    serverURL: URL,
    oidcConfig?: OIDCConfig,
    autoHandleRedirect = true,
    deferUserInfoFetching = false,
  ) {
    this.serverURL = serverURL;

    if (oidcConfig) {
      this.oidcManager = new OIDCManager(oidcConfig, serverURL);
    }

    this.clientServerBus = new ClientServerBus(() => this.getAccessToken());

    this.clientServerBus.subscribeConnectionInterrupted(() => {
      if (this.connectionLostHandler) {
        this.connectionLostHandler();
      }
    });

    this.Attribute = new AttributesRepository(this, () => this.getClientServerBus());
    this.clientId = uuid();
    this.Fact = new FactsRepository(this);

    if (!deferUserInfoFetching) {
      this.ensureUserIdIsKnown();
    }

    if (this.oidcManager) {
      if (
        autoHandleRedirect
        && typeof window !== 'undefined'
        && window.location
        && window.location.search
      ) {
        const params = new URLSearchParams(window.location.search);
        if (params.has('code') && params.has('state')) {
          this.oidcManager
            .handleRedirectCallback()
            .then(() => {
              // Clean up the URL after handling the callback
              // Remove OIDC parameters from the URL
              // for a cleaner user experience
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname,
              );
            });
        }
      }
    }
  }

  public getAttributeClientId(): string {
    this.attributeClientIdSuffix += 1;
    return `${this.clientId}-${this.attributeClientIdSuffix}`;
  }

  public async getClientServerBus(): Promise<ClientServerBus> {
    return this.clientServerBus;
  }

  public async getUserIdByEmail(email: string): Promise<string | undefined> {
    const resp = await this.fetch(`/userinfo?email=${encodeURIComponent(email)}`);
    const parsed = await resp.json();
    return parsed.id;
  }

  public async isAuthorizedToSeeMemberOf(nodeId: string):Promise<boolean> {
    const response = await this.fetch(`/attributes/${nodeId}/members?clientId=${this.clientId}`, { doNotHandleExpiredSessions: true });
    return !!response;
  }

  public async getMembersOf(nodeId: string): Promise<{ id: string, username: string }[]> {
    const response = await this.fetch(`/attributes/${nodeId}/members?clientId=${this.clientId}`);

    if (!response) {
      // TODO: remove this check once the this.fetch throws an exception
      throw new Error(`Unauthorized member query for ${nodeId}`);
    }

    const data = await response.json();

    if (data.notVisibleToUser) {
      throw new Error(`Unauthorized member query for ${nodeId}`);
    }

    return data;
  }

  public async getQuota(nodeId?: string): Promise<QuotaAsJSON> {
    if (this.qetQuotaPromise[nodeId || '']) {
      return this.qetQuotaPromise[nodeId || ''];
    }

    this.qetQuotaPromise[nodeId || ''] = this.ensureUserIdIsKnown()
      .then((uId) => this.fetch(`/quota/${nodeId || uId}`))
      .then((r) => r.json());

    const result = await this.qetQuotaPromise[nodeId || ''];
    delete this.qetQuotaPromise[nodeId || ''];

    return result;
  }

  public async fetch(url: string, fetchOpt?: FetchOptions) {
    const isOnRedirectUriRoute = await this.oidcManager?.isOnRedirectUriRoute();

    const {
      headers = undefined,
      method = 'GET',
      body = undefined,
      isJSON = true,
      doNotHandleExpiredSessions = false,
      skipWaitForUserId = false,
    } = fetchOpt || {};

    if (isOnRedirectUriRoute) {
      // We are on the OIDC redirect URI: delay requests briefly to avoid
      // triggering the login flow again while the session is being established.
      await new Promise((resolve) => { setTimeout(resolve, 2000); });
    }

    if (!skipWaitForUserId) {
      await this.ensureUserIdIsKnown();
    }

    const base = this.serverURL.toString().replace(/\/$/, '');
    const path = url.replace(/^\//, '');
    const absoluteUrl = `${base}/${path}`;
    const options: any = {
      method,
      credentials: 'include',
    };

    const mergedHeaders: Record<string, string> = headers
      ? { ...(headers as Record<string, string>) }
      : {};

    // If OIDC is enabled and access token is available, use Bearer token
    if (this.oidcManager) {
      const accessToken = await this.oidcManager.getAccessToken();
      if (accessToken) {
        mergedHeaders['Authorization'] = `Bearer ${accessToken}`;
        // For cross-origin, do not send cookies if using Bearer
        options.credentials = 'same-origin';
      }
    }

    if (body) {
      options.body = body;
    }

    if (Object.keys(mergedHeaders).length > 0) {
      options.headers = mergedHeaders;
    }

    if (isJSON) {
      if (!options.headers) {
        options.headers = {};
      }
      options.headers.Accept = 'application/json';
      options.headers['Content-Type'] = 'application/json';
    }

    const response = await this.withConnectionLostHandler(() => fetch(absoluteUrl, options));

    if (response.status === 401) {
      console.error(`Authorization Error when calling ${method} ${url} ${await response.text()}`);

      // TODO: Throw an error here so the program code does not just move on as nothing happened.

      if (!doNotHandleExpiredSessions) {
        this.handleExpiredLoginSession();
      }

      return false;
    }

    if (response.status === 403) {
      this.handleQuotaViolationError(response);
      return false;
    }

    if (!response.ok) {
      this.handleUnknownServerError(response);
      return false;
    }

    return response;
  }

  public async withConnectionLostHandler(fn: () => Promise<any>) {
    try {
      return await fn();
    } catch (ex: any) {
      if (ex.message === 'Failed to fetch') {
        this.handleConnectionError(ex);
      }

      return false;
    }
  }

  public setConnectionLostHandler(handler: (err?) => void) {
    this.connectionLostHandler = handler;
  }

  public handleConnectionError(error) {
    if (this.connectionLostHandler) {
      this.connectionLostHandler(error);
    } else {
      console.log('Connection Lost', error);
    }
  }

  public setLoginHandler(handler: () => void) {
    this.loginHandler = handler;
  }

  public handleExpiredLoginSession() {
    if (this.loginHandler) {
      this.loginHandler();
    }
  }

  public setUnknownServerErrorHandler(handler: (response) => void) {
    this.unknownServerErrorHandler = handler;
  }

  public handleUnknownServerError(response) {
    if (this.unknownServerErrorHandler) {
      this.unknownServerErrorHandler(response);
    } else {
      console.log('UnknownServerError', response);
    }
  }

  public setQuotaViolationErrorHandler(handler: (response) => void) {
    this.quotaViolationErrorHandler = handler;
  }

  public handleQuotaViolationError(response) {
    if (this.quotaViolationErrorHandler) {
      this.quotaViolationErrorHandler(response);
    } else {
      this.handleUnknownServerError(response);
    }
  }

  async ensureUserIdIsKnown(): Promise<string | undefined> {
    if (this.actorId && typeof this.actorId === 'string') {
      return this.actorId;
    }

    if (!LinkedRecords.ensureUserIdIsKnownPromise) {
      LinkedRecords.ensureUserIdIsKnownPromise = this.fetch('/userinfo', { skipWaitForUserId: true })
        .then(async (response) => {
          if (!response || response.status === 401) {
            this.handleExpiredLoginSession();
          }

          const responseBody = await response.json();
          return responseBody.userId;
        });
    }

    try {
      this.actorId = await LinkedRecords.ensureUserIdIsKnownPromise;
      return this.actorId;
    } finally {
      LinkedRecords.ensureUserIdIsKnownPromise = undefined;
    }
  }

  // OIDC Auth methods
  public async login() {
    if (!this.oidcManager) throw new Error('OIDC not configured');
    await this.oidcManager.login();
  }

  public async handleRedirectCallback() {
    if (!this.oidcManager) throw new Error('OIDC not configured');
    return this.oidcManager.handleRedirectCallback();
  }

  public async logout() {
    if (!this.oidcManager) throw new Error('OIDC not configured');
    await this.oidcManager.logout();
  }

  public async isAuthenticated() {
    if (!this.oidcManager) return false;
    return this.oidcManager.isAuthenticated();
  }

  public async getUser() {
    if (!this.oidcManager) return null;
    return this.oidcManager.getUser();
  }

  public async getAccessToken() {
    if (!this.oidcManager) return null;
    return this.oidcManager.getAccessToken();
  }
}
