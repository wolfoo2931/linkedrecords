/* eslint-disable import/no-cycle */
/* eslint-disable no-console */
// eslint-disable-next-line max-classes-per-file
import AbstractAttributeServer, { LoadResult } from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import LongTextChange from '../long_text_change';
import QueuedTasks, { IsQueue } from '../../../../lib/queued-tasks';
import IsLogger from '../../../../lib/is_logger';
import AttributeStorage from '../../attribute_storage/psql_with_history';

const queue: IsQueue = QueuedTasks.create();

export default class LongTextAttribute extends AbstractAttributeServer<
string,
LongTextChange
> {
  storage: AttributeStorage;

  public static getDataTypePrefix(): string {
    return 'l';
  }

  constructor(
    id: string,
    clientId: string,
    actorId: string,
    logger: IsLogger,
  ) {
    super(id, clientId, actorId, logger);

    this.storage = new AttributeStorage(logger);
  }

  // eslint-disable-next-line class-methods-use-this
  async getStorageRequiredForValue(value: string): Promise<number> {
    return Buffer.byteLength(value, 'utf8');
  }

  async getStorageRequiredForChange(
    change: SerializedChangeWithMetadata<LongTextChange>,
  ): Promise<number> {
    return this.getStorageRequiredForValue(change.change.changeset);
  }

  async create(value: string) : Promise<{ id: string }> {
    await this.createAccountableFact();

    return this.storage.createAttribute(this.id, this.actorId, value);
  }

  async get(args?: { inAuthorizedContext?: boolean }) : Promise<LoadResult<string>> {
    return this.getByChangeId('2147483647', args);
  }

  async set(value: string) : Promise<{ id: string }> {
    return queue
      .do(this.id, () => this.storage.insertAttributeSnapshot(this.id, this.actorId, value));
  }

  async change(
    changeWithMetadata: SerializedChangeWithMetadata<LongTextChange>,
  ) : Promise<SerializedChangeWithMetadata<LongTextChange>> {
    const serializedChangeset = changeWithMetadata.change.changeset;
    const parentVersion = changeWithMetadata.change.changeId;

    try {
      LongTextChange.fromString(serializedChangeset);
    } catch (err) {
      throw new Error('the specified changeset is invalid (must be a string that has been serialized with changeset.pack(); see: https://github.com/marcelklehr/changesets/blob/master/lib/Changeset.js#L320-L337)');
    }

    if (!parentVersion) {
      throw new Error('the changeset must also contain a parent version');
    }

    return queue
      .do(this.id, async () => {
        const result = await this.changeByChangeset(
          LongTextChange.fromString(serializedChangeset),
          parentVersion,
        );

        return new SerializedChangeWithMetadata(
          this.id,
          result.actorId,
          result.clientId,
          new LongTextChange(result.transformedClientChange, result.changeId),
          result.updatedAt,
        );
      });
  }

  private async getByChangeId(
    changeId: string,
    args?: { inAuthorizedContext?: boolean },
  ) : Promise<LoadResult<string>> {
    const queryOptions = { maxChangeId: changeId, inAuthorizedContext: args?.inAuthorizedContext };
    const result = await this.storage.getAttributeLatestSnapshot(
      this.id,
      this.actorId,
      queryOptions,
    );

    if (result.changeId === changeId) {
      return result;
    }

    // TODO: query options should be something
    // like { minChangeId: result.changeId, maxChangeId: changeId }
    const changes = await this.storage.getAttributeChanges(
      this.id,
      this.actorId,
      {
        ...queryOptions,
        minChangeId: result.changeId,
      },
    );

    if (changes.length && changes[0].changeId === result.changeId) {
      changes.shift();
    }

    changes.forEach((change) => {
      result.value = LongTextChange.fromString(change.value).apply(result.value);
      result.changeId = change.changeId;
      result.actorId = change.actorId;
      result.updatedAt = change.time;
    });

    if (changes.length >= 100) {
      await this.storage.insertAttributeSnapshot(
        this.id,
        this.actorId,
        result.value,
        result.changeId,
      );
    }

    return result;
  }

  private async getChangeSince(changeId: string) : Promise<LongTextChange | null> {
    const changes = await this.storage.getAttributeChanges(
      this.id,
      this.actorId,
      { minChangeId: changeId },
    );

    if (!changes.length) {
      return null;
    }

    let merged: LongTextChange | null = null;

    changes.forEach((change) => {
      const tmp = LongTextChange.fromString(change.value);

      if (merged) {
        merged = merged.merge(tmp);
      } else {
        merged = tmp;
      }
    });

    return merged;
  }

  // Applies the changeset which can be based on
  // an older version of the variable value.
  // This is because the client which constructed
  // the changeset might not have the latest changes from the server
  // This is the "one-step diamond problem" in operational transformation
  // see: http://www.codecommit.com/blog/java/understanding-and-applying-operational-transformation
  private async changeByChangeset(
    changeset: LongTextChange,
    parentVersion: string,
  ) : Promise<{
      changeId: string,
      clientId: string,
      actorId: string,
      updatedAt: Date,
      transformedClientChange: string
    }> {
    // the a in the simple one-step diamond problem
    // the changeset coming from the client, probably
    // made on an older version of the attribute (the server version might be newer)
    const clientChange = changeset;

    // the b in the simple one-step diamond problem
    // the compound changes on the server side which
    // are missing on the client site (the changeset
    // from the client site does not consider this changes)
    const serverChange = await this.getChangeSince(parentVersion);

    // the a' in the simple one-step diamond problem
    // this changeset will be applied to the current server sate and send to all clients
    // This works because of the TP1 property of the transformAgainst function
    // see: https://en.wikipedia.org/wiki/Operational_transformation#Convergence_properties
    const transformedClientChange = clientChange.transformAgainst(serverChange, false).toString();

    await this.ensureChangeCanBeApplied(transformedClientChange, clientChange);

    // TODO: we do not know yet for sure if this changeset will be applicable
    // to the already inserted changesets.
    const insertResult = await this.storage.insertAttributeChange(
      this.id,
      this.actorId,
      transformedClientChange,
    );

    return {
      changeId: insertResult.id,
      updatedAt: insertResult.updatedAt,
      clientId: this.clientId,
      actorId: this.actorId,
      transformedClientChange,
    };
  }

  async ensureChangeCanBeApplied(
    transformedClientChange: string,
    clientChange: LongTextChange,
  ) {
    const latestStateInDb = await this.getByChangeId('2147483647');

    try {
      const tcc = LongTextChange.fromString(transformedClientChange);
      tcc.apply(latestStateInDb.value);
    } catch (ex) {
      console.log('Error: New change could not be applied to the database state');
      console.log('      server state:            ', latestStateInDb.value);
      console.log('      server version:          ', latestStateInDb.changeId);
      console.log('      clientChange:            ', clientChange?.changeset?.inspect());
      console.log('      transformedClientChange: ', LongTextChange.fromString(transformedClientChange)?.changeset?.inspect());

      throw new Error('The new change could not be merged into the server state');
    }
  }
}
