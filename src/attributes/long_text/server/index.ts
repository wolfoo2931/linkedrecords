// eslint-disable-next-line max-classes-per-file
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import LongTextChange from '../long_text_change';
import Fact from '../../../facts/server';
import QueuedTasks, { IsQueue } from '../../../../lib/queued-tasks';

const queue: IsQueue = QueuedTasks.create();

export default class LongTextAttribute extends AbstractAttributeServer<
string,
LongTextChange,
IsAttributeStorage
> {
  public static getDataTypePrefix(): string {
    return 'l';
  }

  async create(value: string) : Promise<{ id: string }> {
    const createdByFact = new Fact(this.actorId, '$isAccountableFor', this.id, this.logger);
    await createdByFact.save(this.actorId);
    return this.storage.createAttribute(this.id, this.actorId, value);
  }

  async get() : Promise<{
    value: string,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }> {
    return this.getByChangeId('2147483647');
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
  ) : Promise<{
      value: string,
      changeId: string,
      actorId: string,
      createdAt: number,
      updatedAt: number
    }> {
    const queryOptions = { maxChangeId: changeId };
    const result = await this.storage.getAttributeLatestSnapshot(
      this.id,
      this.actorId,
      queryOptions,
    );

    // TODO: query options should be something
    // like { minChangeId: result.changeId, maxChangeId: changeId }
    const changes = await this.storage.getAttributeChanges(
      this.id,
      this.actorId,
      queryOptions,
    );

    changes.forEach((change) => {
      result.value = LongTextChange.fromString(change.value).apply(result.value);
      result.changeId = change.changeId;
      result.actorId = change.actorId;
      result.updatedAt = change.time;
    });

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
      transformedServerChange?: string,
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

    // the b' in the simple one-step diamond problem
    // this changeset will be applied on the client who
    // made the change that does not respect the serverChange
    // This works because of the TP1 property of the
    // transformAgainst function. see: https://en.wikipedia.org/wiki/Operational_transformation#Convergence_properties
    const transformedServerChange = serverChange?.transformAgainst(clientChange, true).toString();

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
      transformedServerChange,
      transformedClientChange,
    };
  }
}
