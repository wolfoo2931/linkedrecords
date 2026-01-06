import { CompoundAttributeQuery } from '../../attributes/attribute_query';
import Fact from '../../facts/server';
import IsLogger from '../../../lib/is_logger';
import PredicateExtractor from './predicate_extractor';

interface SubscriptionData {
  subscriptionId: string;
  userId: string;
  query: CompoundAttributeQuery;
  predicates: Set<string>;
  objectValues: Set<string>;
}

export default class QuerySubscriptionService {
  private subscriptions: Map<string, SubscriptionData> = new Map();
  private predicateIndex: Map<string, Set<string>> = new Map(); // predicate → subscriptionIds
  private objectIndex: Map<string, Set<string>> = new Map(); // object value → subscriptionIds
  private sendMessage: ((channel: string, body: any) => void) | null = null;

  /**
   * Initialize the service with the sendMessage function from client-server-bus
   */
  setSendMessageFunction(sendMessage: (channel: string, body: any) => void): void {
    this.sendMessage = sendMessage;
  }

  /**
   * Register a new query subscription
   */
  subscribe(userId: string, query: CompoundAttributeQuery, subscriptionId: string, logger: IsLogger): void {
    // Extract predicates and object values from query
    const { predicates, objectValues } = PredicateExtractor.extractFromQuery(query);

    // Store subscription data
    const subscription: SubscriptionData = {
      subscriptionId,
      userId,
      query,
      predicates,
      objectValues
    };
    this.subscriptions.set(subscriptionId, subscription);

    // Index by predicates
    predicates.forEach((predicate) => {
      if (!this.predicateIndex.has(predicate)) {
        this.predicateIndex.set(predicate, new Set());
      }
      this.predicateIndex.get(predicate)!.add(subscriptionId);
    });

    // Index by object values
    objectValues.forEach((objectValue) => {
      if (!this.objectIndex.has(objectValue)) {
        this.objectIndex.set(objectValue, new Set());
      }
      this.objectIndex.get(objectValue)!.add(subscriptionId);
    });

    logger.info(`Query subscription registered: ${subscriptionId} for user ${userId}, predicates: ${Array.from(predicates).join(', ')}`);
  }

  /**
   * Unsubscribe and cleanup indexes
   */
  unsubscribe(subscriptionId: string, logger: IsLogger): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      logger.warn(`Attempted to unsubscribe non-existent subscription: ${subscriptionId}`);
      return;
    }

    // Remove from predicate indexes
    subscription.predicates.forEach((predicate) => {
      const subscriptions = this.predicateIndex.get(predicate);
      if (subscriptions) {
        subscriptions.delete(subscriptionId);
        if (subscriptions.size === 0) {
          this.predicateIndex.delete(predicate);
        }
      }
    });

    // Remove from object indexes
    subscription.objectValues.forEach((objectValue) => {
      const subscriptions = this.objectIndex.get(objectValue);
      if (subscriptions) {
        subscriptions.delete(subscriptionId);
        if (subscriptions.size === 0) {
          this.objectIndex.delete(objectValue);
        }
      }
    });

    // Remove subscription
    this.subscriptions.delete(subscriptionId);

    logger.info(`Query subscription removed: ${subscriptionId}`);
  }

  /**
   * Called when a fact is created or deleted - finds affected subscriptions and sends pings
   */
  async onFactChanged(fact: Fact, logger: IsLogger): Promise<void> {
    if (!this.sendMessage) {
      logger.warn('SendMessage function not initialized in QuerySubscriptionService');
      return;
    }

    // Extract predicate and object from fact
    const { predicate, object } = PredicateExtractor.extractFromFact(fact);

    // Find potentially affected subscriptions
    const affectedSubscriptionIds = this.findPotentiallyAffectedSubscriptions(predicate, object);

    // Send ping to each affected subscription
    affectedSubscriptionIds.forEach((subscriptionId) => {
      this.sendPing(subscriptionId, logger);
    });

    if (affectedSubscriptionIds.size > 0) {
      logger.info(`Fact change (${predicate}) triggered ${affectedSubscriptionIds.size} subscription pings`);
    }
  }

  /**
   * Find subscriptions that might be affected by a fact change
   */
  private findPotentiallyAffectedSubscriptions(predicate: string, object: string): Set<string> {
    const affectedIds = new Set<string>();

    // Find subscriptions watching this predicate
    const predicateSubscriptions = this.predicateIndex.get(predicate);
    if (predicateSubscriptions) {
      predicateSubscriptions.forEach(id => affectedIds.add(id));
    }

    // Also check for transitive predicate subscriptions (e.g., isA* when fact is isA)
    const transitivePredicateSubscriptions = this.predicateIndex.get(`${predicate}*`);
    if (transitivePredicateSubscriptions) {
      transitivePredicateSubscriptions.forEach(id => affectedIds.add(id));
    }

    // Optional: Also check object value index for more precise matching
    // This can reduce false positives but adds complexity
    // Disabled for MVP - predicates alone provide good-enough filtering

    return affectedIds;
  }

  /**
   * Send a ping notification to a subscription
   */
  private sendPing(subscriptionId: string, logger: IsLogger): void {
    if (!this.sendMessage) {
      logger.warn('Cannot send ping: SendMessage function not initialized');
      return;
    }

    // Send minimal ping to subscription channel
    // The client-server-bus + Redis will route this to the correct server instance(s)
    this.sendMessage(`query-sub-${subscriptionId}`, {
      type: 'query_change_ping',
      subscriptionId
    });

    logger.debug(`Sent ping to subscription: ${subscriptionId}`);
  }

  /**
   * Get subscription count for monitoring
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get predicate index size for monitoring
   */
  getPredicateIndexSize(): number {
    return this.predicateIndex.size;
  }
}
