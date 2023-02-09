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

  async ensureUserIdIsKnown() {
    if (LinkedRecords.ensureUserIdIsKnownPromise) {
      await LinkedRecords.ensureUserIdIsKnownPromise;
    } else {
      LinkedRecords.ensureUserIdIsKnownPromise = await fetch(`${this.serverURL}userinfo`, {
        credentials: 'include',
      });

      this.actorId = LinkedRecords.readUserIdFromCookies();

      LinkedRecords.ensureUserIdIsKnownPromise = undefined;
    }
  }
}
