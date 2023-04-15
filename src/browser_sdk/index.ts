/* eslint-disable import/no-cycle */

import { v4 as uuid } from 'uuid';

import Cookies from 'js-cookie';
import LongTextAttribute from '../attributes/long_text/client';
import KeyValueAttribute from '../attributes/key_value/client';
import KeyValueChange from '../attributes/key_value/key_value_change';
import LongTextChange from '../attributes/long_text/long_text_change';
import ServerSideEvents, { IsSubscribable } from '../../lib/server-side-events/client';
import FactsRepository from './facts_repository';
import AttributesRepository from './attributes_repository';

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
};

export default class LinkedRecords {
  static ensureUserIdIsKnownPromise;

  serverSideEvents: IsSubscribable;

  serverURL: URL;

  loginURL?: URL;

  loginHandler?: (URL) => void;

  connectionLostHandler?: () => void;

  unkownServerErrorHandler?: (response) => void;

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

  constructor(serverURL: URL, serverSideEvents?: IsSubscribable, loginURL?: URL) {
    this.serverURL = serverURL;
    this.loginURL = loginURL;
    this.actorId = LinkedRecords.readUserIdFromCookies();
    this.clientId = uuid();
    this.serverSideEvents = serverSideEvents || new ServerSideEvents();
    this.Attribute = new AttributesRepository(this, this.serverSideEvents);
    this.Fact = new FactsRepository(this);
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
      this.handleExpiredLoginSession();
      return false;
    }

    if (!response.ok) {
      this.handleUnkownServerError(response);
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

  public setConnectionLostHandler(handler: () => void) {
    this.connectionLostHandler = handler;
  }

  public handleConnectionError(error) {
    if (this.connectionLostHandler) {
      this.connectionLostHandler();
    } else {
      console.log('Connection Lost', error);
    }
  }

  public setLoginHandler(handler: (URL) => void) {
    this.loginHandler = handler;
  }

  public handleExpiredLoginSession() {
    if (this.loginURL && this.loginHandler) {
      this.loginHandler(this.loginURL);
    }
  }

  public setUnkownServerErrorHandler(handler: (response) => void) {
    this.unkownServerErrorHandler = handler;
  }

  public handleUnkownServerError(response) {
    if (this.unkownServerErrorHandler) {
      this.unkownServerErrorHandler(response);
    } else {
      console.log('UnkownServerError', response);
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
