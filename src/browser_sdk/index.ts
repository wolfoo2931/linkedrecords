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
import { AttributeQuery, CompoundAttributeQuery } from '../attributes/attribute_query';

type FetchOptions = {
  headers?: object | undefined,
  method?: string,
  body?: any,
  isJSON?: boolean,
};

export {
  LongTextAttribute,
  KeyValueAttribute,
  KeyValueChange,
  LongTextChange,
  AttributeQuery,
  CompoundAttributeQuery,
};

export default class LinkedRecords {
  static ensureUserIdIsKnownPromise;

  clientServerBus: ClientServerBus;

  serverURL: URL;

  loginHandler?: () => void;

  connectionLostHandler?: (err?) => void;

  unknownServerErrorHandler?: (response) => void;

  clientId: string;

  actorId: string;

  Attribute: AttributesRepository;

  Fact: FactsRepository;

  static readUserIdFromCookies() {
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

  public getClientServerBus(): ClientServerBus {
    return this.clientServerBus;
  }

  public async getUserIdByEmail(email: string): Promise<string | undefined> {
    const resp = await this.fetch(`/userinfo?email=${encodeURIComponent(email)}`);
    const parsed = await resp.json();
    return parsed.id;
  }

  public async getMembersOf(nodeId: string): Promise<{ id: string, username: string }[]> {
    const response = await this.fetch(`/attributes/${nodeId}/members?clientId=${this.clientId}`);

    if (!response) {
      // TODO: remove this check once the this.fetch throws an exception
      throw new Error(`Unauthorized member query for ${nodeId}`);
    }

    return response.json();
  }

  public async fetch(url: string, fetchOpt?: FetchOptions) {
    const {
      headers = undefined,
      method = 'GET',
      body = undefined,
      isJSON = true,
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

      this.handleExpiredLoginSession();
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

  async ensureUserIdIsKnown(): Promise<string | undefined> {
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
}
