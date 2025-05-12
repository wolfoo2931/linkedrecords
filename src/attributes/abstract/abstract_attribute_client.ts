/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */

import LinkedRecords from '../../browser_sdk/index';
import SerializedChangeWithMetadata from './serialized_change_with_metadata';
import IsSerializable from './is_serializable';
import ClientServerBus from '../../../lib/client-server-bus/client';

export default abstract class AbstractAttributeClient <Type, TypedChange extends IsSerializable > {
  linkedRecords: LinkedRecords;

  clientServerBus: ClientServerBus;

  id?: string;

  actorId: string | undefined;

  clientId: string;

  createdAt: Date | undefined;

  updatedAt: Date | undefined;

  serverURL: URL;

  observers: Function[];

  isInitialized: boolean;

  version: string; // TODO: should be number

  value: Type;

  attrSubscription?: [string, (data: any) => any] = undefined;

  readToken?: string;

  constructor(linkedRecords: LinkedRecords, clientServerBus: ClientServerBus, id?: string) {
    this.id = id;
    this.linkedRecords = linkedRecords;
    this.clientServerBus = clientServerBus;
    this.serverURL = linkedRecords.serverURL;
    this.createdAt = undefined;
    this.updatedAt = undefined;
    this.observers = [];

    // because the same user can be logged on two browsers/laptops, we need
    // a clientId and an actorId. Every attribute needs to have its own clientId.
    this.clientId = linkedRecords.getAttributeClientId();
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
  protected abstract rawChange(delta: TypedChange): Promise<boolean>;
  protected abstract onServerMessage(payload: SerializedChangeWithMetadata<TypedChange>);
  protected abstract onLoad();

  public async create(value: Type, facts?: [ string?, string?, string? ][]) {
    if (this.id) {
      throw new Error(`Cannot create attribute because it has an id assigned (${this.id})`);
    }

    const requestConfig: any = {
      method: 'POST',
      body: this.getCreatePayload(value, facts),
    };

    if (typeof requestConfig.body !== 'string') {
      requestConfig.isJSON = false;
    }

    const url = `/attributes?dtp=${this.getDataTypePrefix()}&clientId=${this.clientId}`;
    const response = await this.linkedRecords.fetch(url, requestConfig);

    if (!response) {
      return;
    }

    if (response.status !== 200) {
      throw new Error(`Error creating attribute: ${await response.text()}`);
    }

    const responseBody = await response.json();

    this.id = responseBody.id;

    if (!this.id || !this.id.trim()) {
      throw new Error('Unknown error occurred: The attribute was not assigned an ID by the server');
    }

    await this.load(responseBody);
  }

  public getId(): string {
    if (!this.id) {
      throw new Error('getId can not return the attribute id as id is undefined');
    }

    return this.id;
  }

  public getClientId(): string {
    if (!this.clientId) {
      throw new Error('clientId can not return the attribute id as id is undefined');
    }

    return this.clientId;
  }

  public getServerURL(): string {
    if (!this.serverURL) {
      throw new Error('serverURL can not return the attribute id as id is undefined');
    }

    return this.serverURL.toString();
  }

  public getDataURL() {
    return `${this.linkedRecords.serverURL}attributes/${this.id}?clientId=${this.clientId}&valueOnly=true`;
  }

  protected getCreatePayload(
    value: Type,
    facts: [ string?, string?, string? ][] = [],
  ): string | FormData {
    if (!this.actorId) {
      throw new Error('actorId is unknown, can not create blob payload!');
    }

    return JSON.stringify({
      clientId: this.clientId,
      actorId: this.actorId,
      facts,
      value,
    });
  }

  public async get() : Promise<{ value: Type, changeId: string, actorId: string } | undefined> {
    const isOk = await this.load();

    if (!isOk) {
      return undefined;
    }

    if (!this.actorId) {
      throw new Error('actorId is unknown, can not get attribute value!');
    }

    return {
      value: this.value,
      changeId: this.version,
      actorId: this.actorId,
    };
  }

  public async getValue() : Promise<Type | undefined> {
    const isOk = await this.load();

    if (!isOk) {
      return undefined;
    }

    return this.value;
  }

  public async set(newValue: Type) : Promise<void> {
    await this.load();

    if (newValue === this.value) {
      return;
    }

    await this.rawSet(newValue);
  }

  public async change(change: TypedChange) : Promise<boolean> {
    await this.load();
    return this.rawChange(change);
  }

  public async subscribe(observer: Function) {
    await this.load();
    this.observers.push(observer);
  }

  // TODO: when an attribute is unloaded it should be removed from the attribute cache
  public unload() {
    if (this.attrSubscription) {
      this.clientServerBus.unsubscribe(this.attrSubscription);
    }
  }

  public async load(serverState?: {
    changeId: string,
    value: string,
    createdAt: Date,
    updatedAt: Date,
    readToken?: string,
  }, forceReload: boolean = false): Promise<boolean> {
    let result = serverState;

    if (this.isInitialized && !forceReload) {
      return true;
    }

    if (!this.id) {
      throw new Error('cannot load an attribute without id');
    }

    if (!result) {
      const url = `/attributes/${this.id}?clientId=${this.clientId}`;
      const response = await this.linkedRecords.fetch(url);

      if (!response) {
        return false;
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
    this.readToken = result.readToken;
    this.isInitialized = true;
    this.onLoad();
    this.notifySubscribers(undefined, undefined);

    if (!this.attrSubscription) {
      const url = `${this.serverURL}attributes/${this.id}/changes?clientId=${this.clientId}`;
      const callback = (parsedData) => {
        if (parsedData.error === 'quota_violation') {
          this.linkedRecords.handleQuotaViolationError(parsedData);
          return;
        }

        if (parsedData.attributeId !== this.id) {
          return;
        }

        this.updatedAt = new Date(parsedData.updatedAt);

        this.onServerMessage(parsedData);
      };

      this.attrSubscription = await this.clientServerBus.subscribe(
        url,
        this.id,
        this.readToken,
        callback,
      );
    }

    return true;
  }

  protected async sendToServer(
    change: SerializedChangeWithMetadata<TypedChange>,
  ): Promise<boolean> {
    if (!this.id) {
      throw Error('cannot send message to server as attribute does not has an id');
    }

    try {
      await this.clientServerBus.send(this.serverURL.toString(), this.id, change);
      return true;
    } catch (ex: any) {
      if (ex.message && ex.message.match && ex.message.match(/unauthorized/)) {
        this.linkedRecords.handleExpiredLoginSession();
      } else {
        this.linkedRecords.handleConnectionError(ex);
      }

      return false;
    }
  }

  protected notifySubscribers(change?: TypedChange, fullChangeInfo?: { actorId: string }) {
    this.observers.forEach((callback) => {
      callback(change, fullChangeInfo);
    });
  }
}
