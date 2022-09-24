/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */

import { v4 as uuid } from 'uuid';
import LinkedRecords from '../../browser_sdk/index';
import SerializedChangeWithMetadata from './serialized_change_with_metadata';
import IsSerializable from './is_serializable';

export default abstract class AbstractAttributeClient <Type, TypedChange extends IsSerializable > {
  linkedRecords: LinkedRecords;

  id?: string;

  actorId: string;

  clientId: string;

  serverURL: URL;

  observers: Function[];

  subscription: any | null;

  isInitialized: boolean;

  version: string;

  value: Type;

  constructor(linkedRecords: LinkedRecords, id?: string) {
    this.id = id;
    this.linkedRecords = linkedRecords;
    this.serverURL = linkedRecords.serverURL;
    this.observers = [];

    // because the same user can be logged on two browsers/laptops, we need
    // a clientId and an actorId
    this.clientId = linkedRecords.clientId;
    this.actorId = linkedRecords.actorId;

    this.version = '0';
    this.value = this.getDefaultValue();
    this.subscription = null;
    this.isInitialized = false;
  }

  public static getDataTypeName() {
    throw new Error('getDataTypeName needs to be implemented in child class');
  }

  public abstract getDataTypePrefix();
  public abstract getDefaultValue() : Type;
  public abstract deserializeValue(serializedValue: string) : Type;

  protected abstract rawSet(newValue: Type): void;
  protected abstract rawChange(delta: TypedChange): void;
  protected abstract onServerMessage(payload: SerializedChangeWithMetadata<TypedChange>);
  protected abstract onLoad();

  public async create(value: Type) {
    if (this.id) {
      throw new Error(`Cannot create attribute because it has an id assigned (${this.id})`);
    }

    this.id = `${this.getDataTypePrefix()}-${uuid()}`;

    const response = await this.withConnectionLostHandler(() => fetch(`${this.linkedRecords.serverURL}attributes/${this.id}?attributeId=${this.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: this.clientId,
        actorId: this.actorId,
        value,
      }),
    }));

    if (!response) {
      throw new Error('Error communicating with the server when creating attribute.');
    }

    if (response.status === 401) {
      this.handleExpiredLoginSession();
      return;
    }

    if (response.status !== 200) {
      throw new Error(`Error creating attribute: ${await response.text()}`);
    }

    const responseBody = await response.json();
    await this.load(responseBody);
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

    this.rawSet(newValue);
  }

  public async change(change: TypedChange) : Promise<void> {
    await this.load();
    await this.rawChange(change);
  }

  public async subscribe(observer: Function) {
    await this.load();
    this.observers.push(observer);
  }

  public handleExpiredLoginSession() {
    const win: Window = window;
    win.location = '/login';
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

  protected async load(serverState?: { changeId: string, value: string }) {
    let result = serverState;

    if (this.isInitialized) {
      return;
    }

    if (!this.id) {
      throw new Error('cannot load an attribute without id');
    }

    this.isInitialized = true;

    if (!result) {
      const url = `${this.serverURL}attributes/${this.id}?attributeId=${this.id}&clientId=${this.clientId}&actorId=${this.actorId}`;
      const response = await this.withConnectionLostHandler(() => fetch(url));

      if (response.status === 401) {
        this.handleExpiredLoginSession();
        return;
      }

      const jsonBody = await response.json();

      result = {
        changeId: jsonBody.changeId,
        value: jsonBody.value,
      };
    }

    this.version = result.changeId;
    this.value = this.deserializeValue(result.value);
    this.onLoad();
    this.notifySubscribers(undefined, undefined);

    if (!this.subscription) {
      const url = `${this.serverURL}attributes/${this.id}/changes?attributeId=${this.id}&clientId=${this.clientId}&actorId=${this.actorId}`;
      this.subscription = new EventSource(url);

      this.subscription.onmessage = (event) => {
        const parsedData = JSON.parse(event.data);
        this.onServerMessage(parsedData);
      };

      this.subscription.onerror = (error) => {
        this.handleConnectionError(error);
      };
    }
  }

  protected async sendToServer(change: SerializedChangeWithMetadata<TypedChange>) {
    const url = `${this.serverURL}attributes/${this.id}?attributeId=${this.id}&clientId=${this.clientId}&actorId=${this.actorId}`;
    const response = await this.withConnectionLostHandler(() => fetch(url, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(change.toJSON()),
    }));

    if (response.status === 401) {
      this.handleExpiredLoginSession();
    }
  }

  protected notifySubscribers(change?: TypedChange, fullChangeInfo?: { actorId: string }) {
    this.observers.forEach((callback) => {
      callback(change, fullChangeInfo);
    });
  }
}
