/* eslint-disable class-methods-use-this */

import IsAttributeStorage from '../../abstract/is_attribute_storage';
import PgPoolWithLog from '../../../../lib/pg-log';
import IsLogger from '../../../../lib/is_logger';
import Fact from '../../../facts/server';
import AuthorizationError from '../../errors/authorization_error';
import { AttributeSnapshot, AttributeChangeCriteria } from '../types';

function getUuidByAttributeId(attributeId: string) {
  const parts = attributeId.split('-');

  parts.shift();

  return parts.join('-');
}

export default class AttributeStorage implements IsAttributeStorage {
  logger: IsLogger;

  pgPool: PgPoolWithLog;

  tablesKnownAsCreated: Map<string, boolean> = new Map();

  constructor(logger: IsLogger) {
    this.logger = logger;
    this.pgPool = new PgPoolWithLog(this.logger);
  }

  async getAttributeTableName(attributeId: string) {
    const [prefix] = attributeId.split('-');

    if (!prefix) {
      throw new Error(`invalid attribute Id: ${attributeId}`);
    }

    const tableName = `${prefix}_attributes_shard_1`;

    if (!this.tablesKnownAsCreated.has(tableName)) {
      await this.pgPool.query(`CREATE TABLE IF NOT EXISTS ${tableName} (
        id UUID PRIMARY KEY,
        actor_id varchar(36),
        updated_at TIMESTAMP,
        created_at TIMESTAMP,
        value TEXT
      )`);

      // TODO: check if there is a dedicated table for the attribute
      // and migrate the data to the shared table.

      this.tablesKnownAsCreated.set(tableName, true);
    }

    // We can do even more sharding here as the attribute id is uuid v7
    // We can use the time part of the uuid to shard the attributes.
    return tableName;
  }

  async createAttribute(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    if (await this.pgPool.findAny('SELECT id FROM facts WHERE subject=$1', [attributeId])) {
      throw new Error('attributeId is invalid');
    }

    const pgTableName = await this.getAttributeTableName(attributeId);
    const createQuery = `INSERT INTO ${pgTableName} (id, actor_id, updated_at, created_at, value) VALUES ($1, $2, $3, $4, $5)`;
    await this.pgPool.query(createQuery, [
      getUuidByAttributeId(attributeId),
      actorId,
      new Date(),
      new Date(),
      value,
    ]);

    return { id: attributeId };
  }

  async getAttributeLatestSnapshot(
    attributeId: string,
    actorId: string,
    { maxChangeId = '2147483647', inAuthorizedContext = false }: AttributeChangeCriteria = {},
  ) : Promise<AttributeSnapshot> {
    if (!inAuthorizedContext) {
      if (!(await Fact.isAuthorizedToReadPayload(attributeId, actorId, this.logger))) {
        // TODO: when this is thrown, it is not visible in the logs probably??
        // And the status code is 500
        throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
      }
    }

    const pgTableName = await this.getAttributeTableName(attributeId);
    const snapshots = await this.pgPool.query(`SELECT value, actor_id, created_at, updated_at from ${pgTableName} WHERE id=$1 LIMIT 1`, [
      getUuidByAttributeId(attributeId),
    ]);

    if (!snapshots.rows.length) {
      throw new Error(`Attribute not found (id: ${attributeId})`);
    }

    const snapshot = snapshots.rows[0];

    if (!snapshot) {
      throw new Error(`No Snapshot found for attribute ${attributeId} with maxChangeId=${maxChangeId}!`);
    }

    return {
      value: snapshot.value,
      changeId: snapshot.change_id,
      actorId: snapshot.actor_id,
      createdAt: Date.parse(snapshot.created_at),
      updatedAt: Date.parse(snapshot.updated_at),
    };
  }

  async getAttributeChanges() : Promise<Array<any>> {
    return [];
  }

  async insertAttributeChange() : Promise<{ id: string, updatedAt: Date }> {
    throw new Error('insertAttributeChange is not implemented for psql storage, use psql_with_history instead');
  }

  async insertAttributeSnapshot(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string, updatedAt: Date }> {
    if (!(await Fact.isAuthorizedToModifyPayload(attributeId, actorId, this.logger))) {
      throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
    }
    const pgTableName = await this.getAttributeTableName(attributeId);
    const result = await this.pgPool.query(`UPDATE ${pgTableName} SET actor_id=$1, updated_at=$2, value=$3 WHERE id=$4 RETURNING updated_at`, [
      actorId,
      new Date(),
      value,
      getUuidByAttributeId(attributeId),
    ]);

    if (!result.rows.length) {
      throw new Error(`Attribute not found (id: ${attributeId})`);
    }

    return { id: '2147483647', updatedAt: new Date(result.rows[0].updated_at) };
  }
}
