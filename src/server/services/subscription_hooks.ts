import Fact from '../../facts/server';
import IsLogger from '../../../lib/is_logger';
import QuerySubscriptionService from './query_subscription_service';

/**
 * Integration hooks for notifying query subscriptions of fact changes
 */
export default class SubscriptionHooks {
  private static querySubscriptionService: QuerySubscriptionService | null = null;

  /**
   * Initialize with the query subscription service instance
   */
  static initialize(service: QuerySubscriptionService): void {
    this.querySubscriptionService = service;
  }

  /**
   * Called when a fact is created or deleted
   */
  static async notifyFactChanged(fact: Fact, logger: IsLogger): Promise<void> {
    // Skip if query subscriptions are disabled or not initialized
    if (!this.querySubscriptionService) {
      return;
    }

    // Feature flag check
    if (process.env['ENABLE_QUERY_SUBSCRIPTIONS'] !== 'true') {
      return;
    }

    try {
      await this.querySubscriptionService.onFactChanged(fact, logger);
    } catch (error) {
      // Don't let subscription notification errors break fact operations
      logger.warn(`Error notifying query subscriptions of fact change: ${(error as Error).message}`);
    }
  }
}
