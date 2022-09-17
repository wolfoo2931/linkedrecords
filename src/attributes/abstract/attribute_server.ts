export default abstract class AbstractAttributeServer <Type, TypeDelta, AttributeStorage> {

    id: string;
    actorId: string;
    clientId: string;
    storage: AttributeStorage;

    constructor(id: string, clientId: string, actorId: string, storage: AttributeStorage) {
        this.id = id;
        this.clientId = clientId;
        this.actorId = actorId;
        this.storage = storage;
    }

    abstract create(value: Type) : Promise<{ id: string }>;
    abstract get() : Promise<{ value: Type, changeId: string, actorId: string }>;
    abstract set(value: Type) : Promise<{id: string}>;
    abstract change(serializedChangeset: string, parentVersion: string) : Promise<{ id: string }>;
}