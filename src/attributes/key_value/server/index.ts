// eslint-disable-next-line @typescript-eslint/no-unused-vars
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import KeyValueChange from '../key_value_change';
import QueuedTasks, { IsQueue } from '../../../../lib/queued-tasks';
import Fact from '../../../facts/server';
import IsLogger from '../../../../lib/is_logger';
import AttributeStorage from '../../attribute_storage/psql';

const queue: IsQueue = QueuedTasks.create();

export default class KeyValueAttribute extends AbstractAttributeServer<
object,
KeyValueChange
> {
  storage: IsAttributeStorage;

  public static getDataTypePrefix(): string {
    return 'kv';
  }

  public static async createAll(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    attr: [AbstractAttributeServer<any, any>, any][],
  ): Promise<string[]> {
    if (!attr[0]) {
      throw new Error('invalid attribute data found when creating all attributes');
    }

    await Fact.saveAllWithoutAuthCheckAndSpecialTreatment(
      attr.map(([a]) => new Fact(a.actorId, '$isAccountableFor', a.id, a.logger)),
      attr[0][0].actorId,
      undefined,
      attr[0][0].logger,
    );

    const storage = new AttributeStorage(attr[0][0].logger, 'kv');

    const result = await storage.createAllAttributes(attr.map((a) => ({
      attributeId: a[0].id,
      actorId: a[0].actorId,
      value: a[1],
    })));

    return result.map((r) => r.id);
  }

  constructor(
    id: string,
    clientId: string,
    actorId: string,
    logger: IsLogger,
  ) {
    super(id, clientId, actorId, logger);

    this.storage = new AttributeStorage(logger, 'kv');
  }

  async getStorageRequiredForValue(value: object): Promise<number> {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  }

  async getStorageRequiredForChange(
    change: SerializedChangeWithMetadata<KeyValueChange>,
  ): Promise<number> {
    return this.getStorageRequiredForValue(change.change);
  }

  async create(value: object) : Promise<{ id: string }> {
    await this.createAccountableFact();
    return this.storage.createAttribute(this.id, this.actorId, JSON.stringify(value));
  }

  async get(args?: { inAuthorizedContext?: boolean }) : Promise<{
    value: object,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }> {
    const queryOptions = { maxChangeId: '2147483647', inAuthorizedContext: args?.inAuthorizedContext };

    const result = await this.storage.getAttributeLatestSnapshot(
      this.id,
      this.actorId,
      queryOptions,
    );

    return {
      value: JSON.parse(result.value),
      changeId: result.changeId,
      actorId: result.actorId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async set(value: object) : Promise<{ id: string, updatedAt: Date }> {
    return this.storage.insertAttributeSnapshot(this.id, this.actorId, JSON.stringify(value));
  }

  async change(
    changeWithMetadata: SerializedChangeWithMetadata<KeyValueChange>,
  ) : Promise<SerializedChangeWithMetadata<KeyValueChange>> {
    return queue
      .do(this.id, async () => {
        const currentValue = await this.get();
        const change = KeyValueChange.fromJSON(changeWithMetadata.change);
        const newValue = change.apply(currentValue.value);
        const updateResult = await this.set(newValue);

        return new SerializedChangeWithMetadata(
          changeWithMetadata.attributeId,
          changeWithMetadata.actorId,
          changeWithMetadata.clientId,
          KeyValueChange.fromJSON(changeWithMetadata.change, '2147483647'),
          updateResult.updatedAt,
        );
      });
  }
}
