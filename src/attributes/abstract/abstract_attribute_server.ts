import SerializedChangeWithMetadata from './serialized_change_with_metadata';
import IsSerializable from './is_serializable';
import IsLogger from '../../../lib/is_logger';

export default abstract class AbstractAttributeServer <
  Type,
  TypedChange extends IsSerializable,
  IsAttributeStorage> {
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

  public static getDataTypePrefix(): string {
    throw new Error('getDataTypePrefix needs to be implemented in child class');
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
