/* eslint-disable import/no-cycle */
import AbstractAttributeServer from '../../attributes/abstract/abstract_attribute_server';
import IsAttributeStorage from '../../attributes/abstract/is_attribute_storage';
import AttributeStorage from '../../attributes/attribute_storage';
import Fact from '../../facts/server';
import IsLogger from '../../../lib/is_logger';
import PgPoolWithLog from '../../../lib/pg-log';
import EnsureIsValid from '../../../lib/utils/sql_values';
import SerializedChangeWithMetadata from '../../attributes/abstract/serialized_change_with_metadata';
import PaymentProvider from '../payment_provider';

const uncheckedStorageConsumption: Record<string, number> = {};
const lastKnownStorageAvailable: Record<string, number> = {};

export type QuotaAsJSON = {
  nodeId: string,
  totalStorageAvailable: number,
  remainingStorageAvailable: number,
  usedStorage: number,
  accounteeInformation: object | undefined,
  userIsAccountable: boolean,
  isUpgraded: boolean,
};

export type QuotaEvent = {
  nodeId: string,
  totalStorageAvailable: number | null,
  paymentProvider: string,
  providerPayload: string,
  providerId: string,
  validFrom?: Date,
};

export default class Quota {
  readonly nodeId: string;

  logger: IsLogger;

  attributeStorage: AttributeStorage;

  pool: PgPoolWithLog;

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

    if (await Quota.isNodeWithQuotaAssignment(nodeId, logger)) {
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

  public static async getLatestQuotaEvent(
    nodeId: string,
    logger: IsLogger,
  ): Promise<QuotaEvent | undefined> {
    const pool = new PgPoolWithLog(logger);
    const data = await pool.query('SELECT * FROM quota_events WHERE node_id=$1 AND valid_from < $2 ORDER BY id DESC', [
      nodeId,
      new Date(),
    ]);

    if (!data.rows.length || !data.rows[0]) {
      return undefined;
    }

    const parsedStorageAvailable = Number.parseInt(data.rows[0].total_storage_available, 10);

    return {
      nodeId: data.rows[0].node_id,
      totalStorageAvailable: parsedStorageAvailable,
      paymentProvider: data.rows[0].payment_provider,
      providerPayload: data.rows[0].payment_provider_payload,
      providerId: data.rows[0].provider_id,
      validFrom: data.rows[0].valid_from,
    };
  }

  constructor(nodeId: string, logger: IsLogger) {
    this.attributeStorage = new AttributeStorage(logger);
    this.pool = new PgPoolWithLog(logger);
    this.nodeId = nodeId;
    this.logger = logger;
  }

  public async set(
    totalStorageAvailable: number | null,
    providerId: string,
    paymentProvider: string,
    paymentProviderPayload: string,
    validFrom?: Date,
  ) {
    await this.pool.query('INSERT INTO quota_events (node_id, total_storage_available, payment_provider, provider_id, payment_provider_payload, valid_from) VALUES ($1, $2, $3, $4, $5, $6)', [
      this.nodeId,
      totalStorageAvailable,
      paymentProvider,
      providerId,
      paymentProviderPayload,
      validFrom || new Date(),
    ]);
  }

  public async toJSON(asAccountee: boolean): Promise<QuotaAsJSON> {
    const data = await Quota.getLatestQuotaEvent(this.nodeId, this.logger);

    const [totalStorageAvailable, usedStorage] = await Promise.all([
      this.getTotalStorageAvailable(data),
      this.getUsedStorageSize(),
    ]);

    let accounteeInformation;

    if (asAccountee) {
      try {
        const [provider, providerSubId] = await this.getPaymentProviderId();
        const paymentProvider = PaymentProvider.getById(provider);
        accounteeInformation = await paymentProvider.loadDetailsForAccountee(providerSubId);
      } catch (ex) {
        this.logger.warn('details for accountee could not be found, skipping');
      }
    }

    return {
      nodeId: this.nodeId,
      userIsAccountable: asAccountee,
      isUpgraded: !!data?.totalStorageAvailable,
      totalStorageAvailable,
      usedStorage,
      remainingStorageAvailable: totalStorageAvailable - usedStorage,
      accounteeInformation,
    };
  }

  public async getPaymentProviderId(): Promise<[string, string]> {
    const data = await Quota.getLatestQuotaEvent(this.nodeId, this.logger);

    if (!data) {
      throw new Error(`No quota event found for node ${this.nodeId}`);
    }

    if (!data.providerId?.trim()) {
      throw new Error(`No provider_id available for quota event with nodeId ${this.nodeId}`);
    }

    if (!data.paymentProvider?.trim()) {
      throw new Error(`No payment_provider available for quota event with nodeId ${this.nodeId}`);
    }

    return [data.paymentProvider?.trim(), data.providerId.trim()];
  }

  public async getTotalStorageAvailable(prefetchedData?: QuotaEvent): Promise<number> {
    const data = prefetchedData || await Quota.getLatestQuotaEvent(this.nodeId, this.logger);

    if (data?.totalStorageAvailable) {
      return data.totalStorageAvailable;
    }

    if (this.nodeId.startsWith('us-')) {
      return Quota.getDefaultStorageSizeQuota();
    }

    return 0;
  }

  private static async isNodeWithQuotaAssignment(
    nodeId: string,
    logger: IsLogger,
  ): Promise<boolean> {
    if (nodeId.startsWith('us-')) {
      return true;
    }

    const data = await Quota.getLatestQuotaEvent(nodeId, logger);
    return !!data;
  }

  private async getAccountableNodes(): Promise<string[]> {
    let factScopeFilter = '';

    if (this.nodeId.startsWith('us-')) {
      const factScope = await Fact.getFactScopeByUser(this.nodeId, this.logger);
      factScopeFilter = `AND facts.fact_box_id IN (${factScope.factBoxIds.map(EnsureIsValid.factBoxId).join(',')})`;
    }

    const res = await this.pool.query(`WITH RECURSIVE rfacts AS (
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
        WHERE cycl = 'N'`, [this.nodeId]);

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
        const available = await Quota.estimateRemainingStorageSize(
          accounteeId,
          storageRequired,
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

  private static async estimateRemainingStorageSize(
    accounteeId: string,
    requiredStorage: number,
    storage: IsAttributeStorage,
    logger: IsLogger,
  ): Promise<number> {
    const mb = 1048576;
    const uncheckedConsumption = (uncheckedStorageConsumption[accounteeId] || 0) + requiredStorage;
    const lastKnownStorageAvailableForAccountee = lastKnownStorageAvailable[accounteeId] || 0;

    uncheckedStorageConsumption[accounteeId] = uncheckedConsumption;

    if (uncheckedConsumption > (0.05 * mb) || lastKnownStorageAvailableForAccountee <= 0) {
      uncheckedStorageConsumption[accounteeId] = 0;
      lastKnownStorageAvailable[accounteeId] = await Quota.getRemainingStorageSize(
        accounteeId,
        storage,
        logger,
      );
    }

    return lastKnownStorageAvailable[accounteeId] || 0;
  }

  private static async getRemainingStorageSize(
    accounteeId: string,
    storage: IsAttributeStorage,
    logger: IsLogger,
  ): Promise<number> {
    const quota = new Quota(accounteeId, logger);
    const totalStoragePromise = quota.getTotalStorageAvailable();
    const usedStoragePromise = quota.getUsedStorageSize();

    return (await totalStoragePromise) - (await usedStoragePromise);
  }

  private async getUsedStorageSize(): Promise<number> {
    const accountableNodes = await this.getAccountableNodes();

    // FIXME: we need a pagination / map reduce approach here
    // We can not combine it in one query because we want to be able to store the facts and
    // the attributes in different databases
    if (accountableNodes.length > 5000) {
      this.logger.warn(`accountable nodes for accounteeId ${this.nodeId} is very big (${accountableNodes.length} nodes)! Implement a map reduce based calculation in linkedrecords to prevent to big sql queries`);
    }

    return this.attributeStorage.getSizeInBytesForAllAttributes(accountableNodes);
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

      accountableMap[attributeId] = nodeWithQuotaAssignment.trim();
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
      const change = AbstractAttributeServer.isValidChange(value) ? value : false;

      const bytesRequired = change
        ? await attribute.getStorageRequiredForChange(
          change as unknown as SerializedChangeWithMetadata<any>,
        )
        : await attribute.getStorageRequiredForValue(value);

      const accountee = accountableMap[attribute.id] || actorId;
      const currently = storageRequiredByAccountee[accountee] || 0;
      storageRequiredByAccountee[accountee] = currently + bytesRequired;
    }));

    return storageRequiredByAccountee;
  }
}
