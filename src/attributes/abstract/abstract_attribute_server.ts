import SerializedChangeWithMetadata from './serialized_change_with_metadata';

export default abstract class AbstractAttributeServer <Type, TypedChange extends { toJSON }, AttributeStorage> {

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

    public static getDataTypePrefix(): string {
        throw 'getDataTypePrefix needs to be implemented in child class';
    }

    abstract create(value: Type) : Promise<{ id: string }>;
    abstract get() : Promise<{ value: Type, changeId: string, actorId: string }>;
    abstract set(value: Type) : Promise<{id: string}>;
    abstract change(change: SerializedChangeWithMetadata<TypedChange>) : Promise<SerializedChangeWithMetadata<TypedChange>>;
}