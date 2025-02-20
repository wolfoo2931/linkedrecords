import AbstractAttributeServer from '../../src/attributes/abstract/abstract_attribute_server';
import IsAttributeStorage from '../../src/attributes/abstract/is_attribute_storage';
import AttributeStorage from '../../src/attributes/attribute_storage';
import Fact from '../../src/facts/server';
import IsLogger from '../is_logger';
import PgPoolWithLog from '../pg-log';

export default class Quota {
  static getDefaultStorageSizeQuota(): number {
    const mb = 1048576;
    return process.env['DEFAULT_STORAGE_SIZE_QUOTA']
      ? parseInt(process.env['DEFAULT_STORAGE_SIZE_QUOTA'], 10) * mb
      : 500 * mb;
  }

  public static async getAccounteeIdForNode(
    nodeId: string,
    logger: IsLogger,
  ): Promise<string> {
    const pool = new PgPoolWithLog(logger);

    // TODO: check if the passed nodeId itself is a node with a quota assigned to it

    if (nodeId.startsWith('us-')) {
      return nodeId;
    }

    // const accountableFact = await pool.query(`SELECT * FROM `);

    const res = await pool.query(`WITH RECURSIVE rfacts AS (
      SELECT facts.subject, facts.predicate, facts.object FROM facts
                      WHERE object = $1
                      AND predicate = '$isAccountableFor'
      UNION ALL
        SELECT facts.subject, facts.predicate, facts.object FROM facts, rfacts
                        WHERE facts.object = rfacts.subject
                        AND facts.predicate = '$isAccountableFor'
      )
      CYCLE object
        SET cycl TO 'Y' DEFAULT 'N'
      USING path_array
      SELECT rfacts.subject
        FROM rfacts
        WHERE cycl = 'N'`, [nodeId]);

    if (res.rows.length === 0) {
      throw new Error(`No accountee found for node ${nodeId}`);
    }

    // we have to find the first node which has a quota assigned to it
    // for now it is the last one which is always a user node.
    return res.rows[res.rows.length - 1].subject;
  }

  public static async getAccountableNodes(
    accounteeId: string,
    logger: IsLogger,
    objectPrefix?: string,
  ): Promise<string[]> {
    const pool = new PgPoolWithLog(logger);

    if (![undefined, 'bl', 'kv', 'l'].includes(objectPrefix)) {
      throw new Error(`Invalid object prefix: ${objectPrefix}`);
    }

    const prefixFilter = objectPrefix ? `AND rfacts.object LIKE '${objectPrefix}%'` : '';

    const res = await pool.query(`WITH RECURSIVE rfacts AS (
      SELECT facts.subject, facts.predicate, facts.object FROM facts
                      WHERE subject = $1
                      AND predicate = '$isAccountableFor'
      UNION ALL
        SELECT facts.subject, facts.predicate, facts.object FROM facts, rfacts
                        WHERE facts.subject = rfacts.object
                        AND facts.predicate = '$isAccountableFor'
      )
      CYCLE object
        SET cycl TO 'Y' DEFAULT 'N'
      USING path_array
      SELECT rfacts.object
        FROM rfacts
        WHERE cycl = 'N'
        ${prefixFilter}`, [accounteeId]);

    return res.rows.map((r) => r.object.trim());
  }

  static async ensureStorageSpaceToSave<T>(
    actorId: string,
    attributesAndValuesToSave: [AbstractAttributeServer<T, any, any>, T][],
    logger: IsLogger,
    factsToSave: Fact[] = [],
  ) {
    const attributeStorage = new AttributeStorage(logger);
    const accountableMap: Record<string, string> = factsToSave.reduce((acc, fact) => {
      if (fact.predicate === '$isAccountableFor') {
        // attribute = accountee
        acc[fact.object] = fact.subject;
      }

      return acc;
    }, {});

    // we have to trace this back to the node which actually has a storage quota assigned to it
    await Promise.all(Object.entries(accountableMap).map(async ([attributeId, accounteeId]) => {
      let nodeWithQuotaAssignment = actorId;

      try {
        nodeWithQuotaAssignment = await Quota.getAccounteeIdForNode(accounteeId, logger);
      } catch (error) {
        logger.info(`Error getting accountee id for node ${accounteeId}, defaulting to actorId ${actorId}`);
      }

      accountableMap[attributeId] = nodeWithQuotaAssignment;
    }));

    const accounteeIds = Array.from(new Set([
      actorId,
      ...Object.values(accountableMap),
    ]));

    const availableSpace: Record<string, number> = {};
    const storageRequired: Record<string, number> = {};

    const prom1 = Promise.all(accounteeIds.map(async (accounteeId) => {
      availableSpace[accounteeId] = await Quota.getRemainingStorageSize(
        accounteeId,
        attributeStorage,
        logger,
      );
    }));

    const prom2 = Promise.all(attributesAndValuesToSave.map(async ([attribute, value]) => {
      const change = AbstractAttributeServer.getChangeIfItMatchesSchema(value);

      const bytesRequired = change
        ? await attribute.getStorageRequiredForChange(change)
        : await attribute.getStorageRequiredForValue(value);

      storageRequired[attribute.id] = bytesRequired;
    }));

    await Promise.all([prom1, prom2]);

    Object.entries(storageRequired).forEach(([attributeId, bytesRequired]) => {
      const accounteeId = accountableMap[attributeId] || actorId;

      if (!availableSpace[accounteeId]) {
        throw new Error(`Unknown Error determining available storage space for ${accounteeId}`);
      }

      availableSpace[accounteeId] -= bytesRequired as number;
    });

    if (!Object.values(availableSpace).find((available: number) => available > 0)) {
      throw new Error('Not enough storage space available');
    }
  }

  static async getRemainingStorageSize(
    accounteeId: string,
    storage: IsAttributeStorage,
    logger: IsLogger,
  ): Promise<number> {
    const accountableNodes = await Quota.getAccountableNodes(accounteeId, logger);

    // FIXME: we need a pagination / map reduce approach here
    // We can not combine it in one query because we want to be able to store the facts and
    // the attributes in different databases
    if (accountableNodes.length > 5000) {
      logger.warn(`accountable nodes for accounteeId ${accounteeId} is very big! Implement a map reduce based calculation in linkedrecords to prevent to big sql queries`);
    }

    const used = await storage.getSizeInBytesForAllAccountableAttributes(accountableNodes);

    return Quota.getDefaultStorageSizeQuota() - used;
  }
}
