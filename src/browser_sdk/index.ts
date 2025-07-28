/* eslint-disable import/no-cycle */

import { uuidv7 as uuid } from 'uuidv7';

import Cookies from 'js-cookie';
import LongTextAttribute from '../attributes/long_text/client';
import KeyValueAttribute from '../attributes/key_value/client';
import KeyValueChange from '../attributes/key_value/key_value_change';
import LongTextChange from '../attributes/long_text/long_text_change';
import ClientServerBus from '../../lib/client-server-bus/client';
import FactsRepository from './facts_repository';
import AttributesRepository from './attributes_repository';
import { QuotaAsJSON } from '../server/quota';

type FetchOptions = {
  headers?: object | undefined,
  method?: string,
  body?: any,
  isJSON?: boolean,
  doNotHandleExpiredSessions?: boolean,
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

  clientServerBus: ClientServerBus;

  serverURL: URL;

  loginHandler?: () => void;

  connectionLostHandler?: (err?) => void;

  unknownServerErrorHandler?: (response) => void;

  quotaViolationErrorHandler?: (response) => void;

  attributeClientIdSuffix: number = 0;

  clientId: string;

  private actorId: string | undefined;

  Attribute: AttributesRepository;

  Fact: FactsRepository;

  static readUserIdFromCookies(): string | undefined {
    const cookieValue = Cookies.get('userId');

    if (!cookieValue) {
      return undefined;
    }

    const withoutSignature = cookieValue.slice(0, cookieValue.lastIndexOf('.'));
    const split = withoutSignature.split(':');
    const userId = split.length === 1 ? split[0] : split[1];

    return userId;
  }

  constructor(serverURL: URL) {
    this.serverURL = serverURL;
    this.actorId = LinkedRecords.readUserIdFromCookies();
    this.clientId = uuid();
    this.clientServerBus = new ClientServerBus();
    this.Attribute = new AttributesRepository(this, this.clientServerBus);
    this.Fact = new FactsRepository(this);

    this.clientServerBus.subscribeConnectionInterrupted(() => {
      if (this.connectionLostHandler) {
        this.connectionLostHandler();
      }
    });
  }

  public getAttributeClientId(): string {
    this.attributeClientIdSuffix += 1;
    return `${this.clientId}-${this.attributeClientIdSuffix}`;
  }

  public getClientServerBus(): ClientServerBus {
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
    const response = await this.fetch(`/quota/${nodeId || this.actorId}`);

    return response.json();
  }

  public async fetch(url: string, fetchOpt?: FetchOptions) {
    const {
      headers = undefined,
      method = 'GET',
      body = undefined,
      isJSON = true,
      doNotHandleExpiredSessions = false,
    } = fetchOpt || {};

    const absoluteUrl = `${this.serverURL.toString().replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    const options: any = {
      method,
      credentials: 'include',
    };

    if (body) {
      options.body = body;
    }

    if (headers) {
      options.headers = headers;
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
      console.error(`Authorization Error when calling ${method} ${url}`);

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

    LinkedRecords.ensureUserIdIsKnownPromise = fetch(`${this.serverURL}userinfo`, {
      credentials: 'include',
    });

    const userInfoResponse = await LinkedRecords.ensureUserIdIsKnownPromise;

    this.actorId = LinkedRecords.readUserIdFromCookies();

    if (userInfoResponse.status === 401) {
      this.handleExpiredLoginSession();
      return undefined;
    }

    LinkedRecords.ensureUserIdIsKnownPromise = undefined;

    return this.actorId;
  }

  async getActorId() {
    return this.actorId;
  }
}
