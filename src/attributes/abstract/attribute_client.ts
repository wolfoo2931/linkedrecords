import { LinkedRecords } from '../../browser_sdk/index'
import Faye from 'faye';
import { v4 as uuid } from 'uuid';

export default abstract class AbstractAttributeClient <Type, TypeDelta> {

    linkedRecords: LinkedRecords;
    id?: string;
    actorId: string;
    clientId: string;
    serverURL: URL;
    bayeuxClient: any;
    observers: Function[];
    subscription: any | null;
    isInitialized: boolean;
    version: string;
    value: Type;

    constructor(linkedRecords: LinkedRecords, id?: string) {
        this.id = id;
        this.linkedRecords = linkedRecords;
        this.serverURL = linkedRecords.serverURL;
        this.bayeuxClient = new Faye.Client(this.serverURL + 'bayeux');
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

    public static getDataTypePrefix() {
        throw 'getDataTypePrefix needs to be implemented in child class';
    }

    public static getDataTypeName() {
        throw 'getDataTypePrefix needs to be implemented in child class';
    }

    public abstract getDefaultValue() : Type;

    protected abstract rawSet(newValue: Type): void;
    protected abstract rawChange(delta: TypeDelta): void;
    protected abstract onServerMessage(payload);
    protected abstract onLoad();

    public async create(value: Type) {
        if(this.id) {
            throw `Cannot create attribute because it has an id assigned (${this.id})`
        }

        this.id = `${AbstractAttributeClient.getDataTypePrefix()}-${uuid()}`;

        const response = await fetch(`${this.linkedRecords.serverURL}attributes/${this.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientId: this.clientId,
                actorId: this.actorId,
                value: value
            })
        });

        if(response.status !== 200) {
            throw `Error creating attribute: ${await response.text()}`;
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

    public async set(newValue: Type) : Promise<void> {
        await this.load();

        if(newValue === this.value) {
            return;
        }

        this.rawSet(newValue);
    }

    public async change(delta: TypeDelta) : Promise<void> {
        await this.load();
        this.rawChange(delta);
    }

    public async subscribe(observer: Function) {
        await this.load();
        this.observers.push(observer);
    }

    protected async load(serverState?: { changeId: string, value: string }) {
        if(this.isInitialized) {
            return;
        }

        if(!this.id) {
            throw `cannot load an attribute without id`;
        }

        this.isInitialized = true;

        const result = serverState || await fetch(`${this.serverURL}attributes/${this.id}`).then(result => result.json())

        this.version = result.changeId;
        this.value = result.value;
        this.onLoad()
        this.notifySubscribers(undefined, undefined);

        this.subscription = this.subscription || this.bayeuxClient.subscribe('/changes/attribute/' + this.id, change => {
            this.onServerMessage(change);
        });
    }

    protected sendToServer(payload) {
        this.bayeuxClient.publish('/uncommited/changes/attribute/' + this.id, payload);
    }

    protected notifySubscribers(change?: TypeDelta, fullChangeInfo?: { actorId: string }) {
        this.observers.forEach(callback => {
            callback(change, fullChangeInfo);
        });
    }
}