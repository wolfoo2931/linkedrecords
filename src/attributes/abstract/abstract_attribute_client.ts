/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */

import { v4 as uuid } from 'uuid';
import LinkedRecords from '../../browser_sdk/index';
import SerializedChangeWithMetadata from './serialized_change_with_metadata';
import IsSerializable from './is_serializable';
import { IsSubscribable } from '../../../lib/server-side-events/client';

export default abstract class AbstractAttributeClient <Type, TypedChange extends IsSerializable > {
  linkedRecords: LinkedRecords;

  serverSideEvents: IsSubscribable;

  id?: string;

  actorId: string;

  clientId: string;

  createdAt: Date | undefined;

  updatedAt: Date | undefined;

  serverURL: URL;

  loginURL?: URL;

  observers: Function[];

  isInitialized: boolean;

  version: string; // TODO: should be number

  value: Type;

  attrSubscription?: [string, (data: any) => any] = undefined;

  constructor(linkedRecords: LinkedRecords, serverSideEvents: IsSubscribable, id?: string) {
    this.id = id;
    this.linkedRecords = linkedRecords;
    this.serverSideEvents = serverSideEvents;
    this.serverURL = linkedRecords.serverURL;
    this.loginURL = linkedRecords.loginURL;
    this.createdAt = undefined;
    this.updatedAt = undefined;
    this.observers = [];

    // because the same user can be logged on two browsers/laptops, we need
    // a clientId and an actorId
    this.clientId = linkedRecords.clientId;
    this.actorId = linkedRecords.actorId;

    this.version = '0';
    this.value = this.getDefaultValue();
    this.isInitialized = false;
  }

  public static getDataTypeName() {
    throw new Error('getDataTypeName needs to be implemented in child class');
  }

  public static isAttributeId(id: string) {
    return id.split('-')[0] === this.prototype.getDataTypePrefix();
  }

  public abstract getDataTypePrefix();
  public abstract getDefaultValue() : Type;
  public abstract deserializeValue(serializedValue: string) : Promise<Type>;

  protected abstract rawSet(newValue: Type): void;
  protected abstract rawChange(delta: TypedChange): void;
  protected abstract onServerMessage(payload: SerializedChangeWithMetadata<TypedChange>);
  protected abstract onLoad();

  public async create(value: Type) {
    if (this.id) {
      throw new Error(`Cannot create attribute because it has an id assigned (${this.id})`);
    }

    let queryParamString = '';

    this.id = `${this.getDataTypePrefix()}-${uuid()}`;

    const requestConfig: any = {
      method: 'POST',
      credentials: 'include',
      body: this.getCreatePayload(value),
    };

    if (typeof requestConfig.body === 'string') {
      requestConfig.headers = {
        'Content-Type': 'application/json',
      };
    } else {
      queryParamString = `?clientId=${this.clientId}&actorId=${this.actorId}`;
    }

    const response = await this.withConnectionLostHandler(() => fetch(`${this.linkedRecords.serverURL}attributes/${this.id}${queryParamString}`, requestConfig));

    if (!response) {
      throw new Error('Error communicating with the server when creating attribute.');
    }

    if (response.status === 401) {
      this.linkedRecords.handleExpiredLoginSession();
      return;
    }

    if (response.status !== 200) {
      throw new Error(`Error creating attribute: ${await response.text()}`);
    }

    const responseBody = await response.json();
    await this.load(responseBody);
  }

  public getDataURL() {
    return `${this.linkedRecords.serverURL}attributes/${this.id}?clientId=${this.clientId}&actorId=${this.actorId}&valueOnly=true`;
  }

  protected getCreatePayload(value: Type): string | FormData {
    return JSON.stringify({
      clientId: this.clientId,
      actorId: this.actorId,
      value,
    });
  }

  public async get() : Promise<{ value: Type, changeId: string, actorId: string }> {
    await this.load();

    return {
      value: this.value,
      changeId: this.version,
      actorId: this.actorId,
    };
  }

  public async getValue() : Promise<Type> {
    await this.load();

    return this.value;
  }

  public async set(newValue: Type) : Promise<void> {
    await this.load();

    if (newValue === this.value) {
      return;
    }

    await this.rawSet(newValue);
  }

  public async change(change: TypedChange) : Promise<void> {
    await this.load();
    await this.rawChange(change);
  }

  public async subscribe(observer: Function) {
    await this.load();
    this.observers.push(observer);
  }

  public handleConnectionError(error) {
    console.log('Connection Lost', error);
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

  public unload() {
    if (this.attrSubscription) {
      this.serverSideEvents.unsubscribe(this.attrSubscription);
    }
  }

  protected async load(serverState?: {
    changeId: string,
    value: string,
    createdAt: Date,
    updatedAt: Date,
  }) {
    let result = serverState;

    if (this.isInitialized) {
      return;
    }

    if (!this.id) {
      throw new Error('cannot load an attribute without id');
    }

    this.isInitialized = true;

    if (!result) {
      const url = `${this.serverURL}attributes/${this.id}?clientId=${this.clientId}&actorId=${this.actorId}`;
      const response = await this.withConnectionLostHandler(() => fetch(url, {
        credentials: 'include',
      }));

      if (response.status === 401 && this.linkedRecords) {
        this.linkedRecords.handleExpiredLoginSession();
        return;
      }

      const jsonBody = await response.json();

      result = {
        changeId: jsonBody.changeId,
        value: jsonBody.value,
        createdAt: new Date(jsonBody.createdAt),
        updatedAt: new Date(jsonBody.updatedAt),
      };
    }

    const serializedValue = typeof result.value === 'string' ? result.value : JSON.stringify(result.value);

    if (!serializedValue) {
      throw new Error('invalid server state');
    }

    this.version = result.changeId;
    this.value = await this.deserializeValue(serializedValue);
    this.createdAt = new Date(result.createdAt);
    this.updatedAt = new Date(result.updatedAt);
    this.onLoad();
    this.notifySubscribers(undefined, undefined);

    const url = `${this.serverURL}attributes/${this.id}/changes?clientId=${this.clientId}&actorId=${this.actorId}`;
    this.attrSubscription = await this.serverSideEvents.subscribe(url, this.id, (parsedData) => {
      if (parsedData.attributeId !== this.id) {
        return;
      }

      this.updatedAt = new Date(parsedData.updatedAt);

      this.onServerMessage(parsedData);
    });
  }

  protected async sendToServer(change: SerializedChangeWithMetadata<TypedChange>) {
    const url = `${this.serverURL}attributes/${this.id}?clientId=${this.clientId}&actorId=${this.actorId}`;
    const response = await this.withConnectionLostHandler(() => fetch(url, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(change.toJSON()),
      credentials: 'include',
    }));

    if (response.status === 401) {
      this.linkedRecords.handleExpiredLoginSession();
    }
  }

  protected notifySubscribers(change?: TypedChange, fullChangeInfo?: { actorId: string }) {
    this.observers.forEach((callback) => {
      callback(change, fullChangeInfo);
    });
  }
}
