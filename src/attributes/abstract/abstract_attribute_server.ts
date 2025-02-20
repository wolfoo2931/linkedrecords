import SerializedChangeWithMetadata from './serialized_change_with_metadata';
import IsSerializable from './is_serializable';
import IsLogger from '../../../lib/is_logger';
import Fact from '../../facts/server';
import StorageDriverInterface from './is_attribute_storage';

export default abstract class AbstractAttributeServer <
  Type,
  TypedChange extends IsSerializable,
  IsAttributeStorage extends StorageDriverInterface,
> {
  id: string;

  actorId: string;

  clientId: string;

  storage: IsAttributeStorage;

  logger: IsLogger;

  constructor(
    id: string,
    clientId: string,
    actorId: string,
    storage: IsAttributeStorage,
    logger: IsLogger,
  ) {
    this.id = id;
    this.clientId = clientId;
    this.actorId = actorId;
    this.storage = storage;
    this.logger = logger;
  }

  // eslint-disable-next-line class-methods-use-this
  public static async getStorageRequiredForValue(value): Promise<number> {
    if ((value as Blob).size) {
      return (value as Blob).size;
    }

    if (typeof value === 'string') {
      return value.length;
    }

    if (typeof value === 'object') {
      return JSON.stringify(value).length;
    }

    throw new Error(`Unknown type to calculate storage requirements: ${typeof value}`);
  }

  public static async getStorageRequiredForChange(
    change: SerializedChangeWithMetadata<any>,
  ): Promise<number> {
    return this.getStorageRequiredForValue(change.change);
  }

  public static getDataTypePrefix(): string {
    throw new Error('getDataTypePrefix needs to be implemented in child class');
  }

  public static async createAll(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    attr: [AbstractAttributeServer<any, any, any>, any][],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    storage: StorageDriverInterface,
  ): Promise<string[]> {
    const result = await Promise.all(attr.map(([a, v]) => a.create(v)));

    return result.map((r) => r.id);
  }

  async createAccountableFact() : Promise<void> {
    const createdByFact = new Fact(this.actorId, '$isAccountableFor', this.id, this.logger);
    await createdByFact.save(this.actorId);
  }

  abstract create(
    value: Type
  ) : Promise<{ id: string }>;

  abstract get() : Promise<{
    value: Type,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }>;

  abstract set(value: Type) : Promise<{ id: string }>;

  abstract change(
    change: SerializedChangeWithMetadata<TypedChange>
  ) : Promise<SerializedChangeWithMetadata<TypedChange>>;
}
