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

export default class LinkedRecords {
  static ensureUserIdIsKnownPromise;

  KeyValueChange: typeof KeyValueChange = KeyValueChange;

  private clientServerBus?: ClientServerBus;

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

  private initializeClientServerBusPromise: Promise<ClientServerBus>;

  constructor(serverURL: URL, oidcConfig?: OIDCConfig, autoHandleRedirect = true) {
    this.serverURL = serverURL;

    if (oidcConfig) {
      this.oidcManager = new OIDCManager(oidcConfig, serverURL);
    }

    this.initializeClientServerBusPromise = this.getAccessToken().then((at) => {
      if (at) {
        this.clientServerBus = new ClientServerBus(at);
      } else {
        this.clientServerBus = new ClientServerBus();
      }

      this.clientServerBus.subscribeConnectionInterrupted(() => {
        if (this.connectionLostHandler) {
          this.connectionLostHandler();
        }
      });

      return this.clientServerBus;
    });

    this.Attribute = new AttributesRepository(this, () => this.getClientServerBus());
    this.clientId = uuid();
    this.Fact = new FactsRepository(this);

    this.ensureUserIdIsKnown();

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
    return this.initializeClientServerBusPromise;
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
    const response = await this.fetch(`/quota/${nodeId || this.actorId}`);

    return response.json();
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
      // If we are on the redirect URI we do not make any requests to the server
      // to avoid triggering the login flow again.
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

    if (LinkedRecords.ensureUserIdIsKnownPromise) {
      await LinkedRecords.ensureUserIdIsKnownPromise;
      return this.actorId;
    }

    LinkedRecords.ensureUserIdIsKnownPromise = this.fetch('/userinfo', { skipWaitForUserId: true });

    try {
      const userInfoResponse: any = await LinkedRecords.ensureUserIdIsKnownPromise;
      if (!userInfoResponse || userInfoResponse.status === 401) {
        this.handleExpiredLoginSession();
        return undefined;
      }

      const responseBody = await userInfoResponse.json();
      this.actorId = responseBody.userId;
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
