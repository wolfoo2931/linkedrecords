import AbstractAttributeServer from '../../src/attributes/abstract/abstract_attribute_server';
import IsAttributeStorage from '../../src/attributes/abstract/is_attribute_storage';
import AttributeStorage from '../../src/attributes/attribute_storage';
import Fact from '../../src/facts/server';
import IsLogger from '../is_logger';
import PgPoolWithLog from '../pg-log';
import EnsureIsValid from '../utils/sql_values';

export default class Quota {
  static getDefaultStorageSizeQuota(): number {
    const mb = 1048576;
    return process.env['DEFAULT_STORAGE_SIZE_QUOTA']
      ? parseInt(process.env['DEFAULT_STORAGE_SIZE_QUOTA'], 10) * mb
      : 500 * mb;
  }

  public static async isNodeWithQuotaAssignment(nodeId: string): Promise<boolean> {
    return nodeId.startsWith('us-');
  }

  public static async getAccounteeIdForNode(
    nodeId: string,
    logger: IsLogger,
  ): Promise<string> {
    const pool = new PgPoolWithLog(logger);

    if (await Quota.isNodeWithQuotaAssignment(nodeId)) {
      return nodeId;
    }

    // TODO: find out the fact box and limit the query to the fact box

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
  ): Promise<string[]> {
    const pool = new PgPoolWithLog(logger);
    let factScopeFilter = '';

    if (accounteeId.startsWith('us-')) {
      const factScope = await Fact.getFactScopeByUser(accounteeId, logger);
      factScopeFilter = `AND facts.fact_box_id IN (${factScope.factBoxIds.map(EnsureIsValid.factBoxId).join(',')})`;
    }

    const res = await pool.query(`WITH RECURSIVE rfacts AS (
      SELECT facts.subject, facts.predicate, facts.object FROM facts
                      WHERE subject = $1
                      AND predicate = '$isAccountableFor' ${factScopeFilter}
      UNION ALL
        SELECT facts.subject, facts.predicate, facts.object FROM facts, rfacts
                        WHERE facts.subject = rfacts.object
                        AND facts.predicate = '$isAccountableFor' ${factScopeFilter}
      )
      CYCLE object
        SET cycl TO 'Y' DEFAULT 'N'
      USING path_array
      SELECT rfacts.object
        FROM rfacts
        WHERE cycl = 'N'`, [accounteeId]);

    return res.rows.map((r) => r.object.trim());
  }

  static async ensureStorageSpaceToSave<T>(
    actorId: string,
    attributesAndValuesToSave: [AbstractAttributeServer<T, any, any>, T][],
    logger: IsLogger,
    factsToSave: Fact[] = [],
  ): Promise<void> {
    const storageViolations: string[] = [];
    const attributeStorage = new AttributeStorage(logger);
    const accountableMap = await Quota.getAccountableMap(logger, actorId, factsToSave);
    const storageRequiredByAccountee = await Quota.getStorageRequiredByAccountee(
      actorId,
      attributesAndValuesToSave,
      accountableMap,
    );

    await Promise.all(
      Object.entries(storageRequiredByAccountee).map(async ([accounteeId, storageRequired]) => {
        const available = await Quota.getRemainingStorageSize(
          accounteeId,
          attributeStorage,
          logger,
        );

        if (available < storageRequired) {
          storageViolations.push(accounteeId);
        }
      }),
    );

    if (storageViolations.length) {
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
      logger.warn(`accountable nodes for accounteeId ${accounteeId} is very big (${accountableNodes.length} nodes)! Implement a map reduce based calculation in linkedrecords to prevent to big sql queries`);
    }

    const used = await storage.getSizeInBytesForAllAttributes(accountableNodes);

    return Quota.getDefaultStorageSizeQuota() - used;
  }

  private static async getAccountableMap(
    logger: IsLogger,
    actorId: string,
    factsToSave: Fact[] = [],
  ): Promise<Record<string, string>> {
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

    return accountableMap;
  }

  private static async getStorageRequiredByAccountee<T>(
    actorId: string,
    attributesAndValuesToSave: [AbstractAttributeServer<T, any, any>, T][],
    accountableMap: Record<string, string>,
  ) {
    const storageRequiredByAccountee: Record<string, number> = {};

    await Promise.all(attributesAndValuesToSave.map(async ([attribute, value]) => {
      const change = AbstractAttributeServer.getChangeIfItMatchesSchema(value);

      const bytesRequired = change
        ? await attribute.getStorageRequiredForChange(change)
        : await attribute.getStorageRequiredForValue(value);

      const accountee = accountableMap[attribute.id] || actorId;
      const currently = storageRequiredByAccountee[accountee] || 0;
      storageRequiredByAccountee[accountee] = currently + bytesRequired;
    }));

    return storageRequiredByAccountee;
  }
}
