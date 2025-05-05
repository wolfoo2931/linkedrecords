/* eslint-disable class-methods-use-this */

import assert from 'assert';
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import PgPoolWithLog from '../../../../lib/pg-log';
import IsLogger from '../../../../lib/is_logger';
import Fact from '../../../facts/server';
import AuthorizationError from '../../errors/authorization_error';
import EnsureIsValid from '../../../../lib/utils/sql_values';
import { AttributeSnapshot, AttributeChangeCriteria, AttributeValue } from '../types';

function getUuidByAttributeId(attributeId: string) {
  const parts = attributeId.split('-');

  parts.shift();

  return EnsureIsValid.nodeId(parts.join('-'));
}

function calculateSize(value: AttributeValue) {
  if (typeof value === 'string') {
    return Buffer.byteLength(value, 'utf8');
  }

  return value.length;
}

export default class AttributeStorage implements IsAttributeStorage {
  logger: IsLogger;

  pgPool: PgPoolWithLog;

  tablePrefix: string;

  constructor(logger: IsLogger, tablePrefix: string) {
    this.logger = logger;
    this.pgPool = new PgPoolWithLog(this.logger);
    this.tablePrefix = tablePrefix;
  }

  async getSizeInBytesForAllAttributes(nodes: string[]): Promise<number> {
    const attrTables = [`${this.tablePrefix}_attributes`];

    const sizes = await Promise.all(attrTables.map(async (tableName) => {
      const [prefix] = tableName.split('_');
      const filteredNodes = nodes.filter((n) => n.startsWith(`${prefix}-`));

      if (!filteredNodes.length) {
        return 0;
      }

      const result = await this.pgPool.query(`SELECT SUM(
          CASE
            WHEN size IS NOT NULL THEN size
            ELSE LENGTH(value)
          END
        )
        FROM ${tableName}
        WHERE ('${prefix}' || '-' || id)
        IN (${filteredNodes.filter((n) => n.startsWith(`${prefix}-`)).map((n) => `'${n}'`).join(',')});`);

      if (!result?.rows[0]) {
        throw new Error('There was a problem getting the size of all accountable attributes');
      }

      let size: number;

      try {
        if (result.rows[0].sum === null) {
          size = 0;
        } else {
          size = parseInt(result.rows[0].sum, 10);
        }
      } catch (e) {
        throw new Error('There was a problem getting the size of all accountable attributes');
      }

      return size;
    }));

    return sizes.reduce((acc, curr) => acc + curr, 0);
  }

  async createAllAttributes(
    attr: { attributeId: string, actorId: string, value: AttributeValue, size?: number }[],
  ) : Promise<{ id: string }[]> {
    if (!attr.length) {
      return [];
    }

    if (await Fact.areKnownSubjects(attr.map((a) => a.attributeId), this.logger)) {
      throw new Error('attribute list contains invalid attributeId');
    }

    const tableNames = await Promise.all(
      attr.map((a) => this.getAttributeTableName(a.attributeId)),
    );

    if (!tableNames[0]) {
      return [];
    }

    if (!tableNames.every((n) => n === tableNames[0])) {
      throw new Error('createAllAttributes can only be used with attributes of the same type');
    }

    const values = attr
      .map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`)
      .join(', ');

    const flatParams = attr.flatMap((a) => [
      a.actorId,
      new Date(),
      new Date(),
      getUuidByAttributeId(a.attributeId),
      a.value,
      a.size || null,
    ]);

    const createQuery = `INSERT INTO ${EnsureIsValid.tableName(tableNames[0])} (actor_id, updated_at, created_at, id, value, size) VALUES ${values}`;
    await this.pgPool.query(createQuery, flatParams);

    return attr.map((a) => ({ id: a.attributeId }));
  }

  async createAttribute(
    attributeId: string,
    actorId: string,
    value: AttributeValue,
    size?: number,
  ) : Promise<{ id: string }> {
    if (await Fact.areKnownSubjects([attributeId], this.logger)) {
      throw new Error('attributeId is invalid');
    }

    return this.createAttributeWithoutFactsCheck(
      attributeId,
      actorId,
      value,
      size,
    );
  }

  async createAttributeWithoutFactsCheck(
    attributeId: string,
    actorId: string,
    value: AttributeValue,
    size?: number,
  ) : Promise<{ id: string }> {
    const pgTableName = await this.getAttributeTableName(attributeId);
    const createQuery = `INSERT INTO ${EnsureIsValid.tableName(pgTableName)} (id, actor_id, updated_at, created_at, value, size) VALUES ($1, $2, $3, $4, $5, $6)`;
    await this.pgPool.query(createQuery, [
      getUuidByAttributeId(attributeId),
      actorId,
      new Date(),
      new Date(),
      value,
      size || calculateSize(value),
    ]);

    return { id: attributeId };
  }

  async getAttributeLatestSnapshots(
    attributeIds: string[],
    actorId: string,
    { inAuthorizedContext = false }: AttributeChangeCriteria = {},
  ) : Promise<AttributeSnapshot[]> {
    if (!attributeIds.length) {
      return [];
    }

    assert(inAuthorizedContext, 'getAttributeLatestSnapshots is not implemented in unauthorized context');
    assert(attributeIds[0]);
    assert(!attributeIds.find((id) => !id || typeof id !== 'string'));

    const pgTableName = await this.getAttributeTableName(attributeIds[0]);
    const idsAsString = attributeIds.map((id) => `'${getUuidByAttributeId(id)}'`);
    const snapshots = await this.pgPool.query(`SELECT id, value, actor_id, created_at, updated_at from ${EnsureIsValid.tableName(pgTableName)} WHERE id IN (${idsAsString.join(',')})`);

    return snapshots.rows.map((snapshot) => ({
      id: snapshot.id,
      value: snapshot.value,
      changeId: snapshot.change_id,
      actorId: snapshot.actor_id,
      createdAt: Date.parse(snapshot.created_at),
      updatedAt: Date.parse(snapshot.updated_at),
    }));
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
    const snapshots = await this.pgPool.query(`SELECT value, actor_id, created_at, updated_at from ${EnsureIsValid.tableName(pgTableName)} WHERE id=$1 LIMIT 1`, [
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
      id: attributeId,
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
    value: AttributeValue,
    changeId?: string,
    size?: number,
  ) : Promise<{ id: string, updatedAt: Date }> {
    if (!(await Fact.isAuthorizedToModifyPayload(attributeId, actorId, this.logger))) {
      throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
    }

    const pgTableName = await this.getAttributeTableName(attributeId);
    const result = await this.pgPool.query(`UPDATE ${EnsureIsValid.tableName(pgTableName)} SET actor_id=$1, updated_at=$2, value=$3, size=$4 WHERE id=$5 RETURNING updated_at`, [
      actorId,
      new Date(),
      value,
      size || calculateSize(value),
      getUuidByAttributeId(attributeId),
    ]);

    if (!result.rows.length) {
      throw new Error(`Attribute not found (id: ${attributeId})`);
    }

    return { id: '2147483647', updatedAt: new Date(result.rows[0].updated_at) };
  }

  private async getAttributeTableName(attributeId: string) {
    const [prefix] = attributeId.split('-');

    if (!prefix) {
      throw new Error(`invalid attribute Id: ${attributeId}`);
    }

    return `${prefix}_attributes`;
  }
}
