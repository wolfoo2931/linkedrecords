import SerializedChangeWithMetadata from './serialized_change_with_metadata';
import IsSerializable from './is_serializable';
import IsLogger from '../../../lib/is_logger';
import Fact from '../../facts/server';

export default abstract class AbstractAttributeServer <
  Type,
  TypedChange extends IsSerializable,
> {
  readonly id: string;

  readonly actorId: string;

  readonly clientId: string;

  readonly logger: IsLogger;

  constructor(
    id: string,
    clientId: string,
    actorId: string,
    logger: IsLogger,
  ) {
    this.id = id;
    this.clientId = clientId;
    this.actorId = actorId;
    this.logger = logger;
  }

  public static isValidChange(
    value: any,
  ): boolean {
    return value
      && value.attributeId
      && value.change
      && value.actorId
      && value.clientId;
  }

  abstract getStorageRequiredForValue(value: Type): Promise<number>;
  abstract getStorageRequiredForChange(change: SerializedChangeWithMetadata<any>): Promise<number>;

  public static getDataTypePrefix(): string {
    throw new Error('getDataTypePrefix needs to be implemented in child class');
  }

  public static async createAll(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    attr: [AbstractAttributeServer<any, any>, any][],
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
