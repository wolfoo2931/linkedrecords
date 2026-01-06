/* eslint-disable class-methods-use-this */
/* eslint-disable max-len */
import * as jose from 'jose';
import http from 'http';
import clientServerBus from '../../lib/client-server-bus/server';
import IsLogger from '../../lib/is_logger';
import SerializedChangeWithMetadata from '../attributes/abstract/serialized_change_with_metadata';
import { getAttributeByMessage } from './middleware/attribute';
import Fact from '../facts/server';
import { uid } from './controllers/userinfo_controller';
import Quota from './quota';
import QuerySubscriptionService from './services/query_subscription_service';
import SubscriptionHooks from './services/subscription_hooks';

class WSAccessControl {
  app: any;

  constructor(app) {
    this.app = app;
  }

  public verifyAuthenticated(
    request: http.IncomingMessage,
  ): Promise<string> {
    const response = new http.ServerResponse(request);

    return new Promise((resolve, reject) => {
      this.app.handle(request, response, () => {
        const { oidc } = request as any;

        if (!oidc || !oidc.isAuthenticated() || !oidc?.user?.sub) {
          reject(new Error('No user id found in request'));
        } else {
          resolve(uid(request));
        }
      });
    });
  }

  public async verifyAuthorizedChannelJoin(
    userId: string,
    channel: string,
    request: http.IncomingMessage,
    readToken?: string,
  ): Promise<boolean> {
    if (!userId) {
      return Promise.resolve(false);
    }

    if (process.env['SHORT_LIVED_ACCESS_TOKEN_SIGNING'] && readToken) {
      try {
        const secret = new TextEncoder().encode(`${process.env['SHORT_LIVED_ACCESS_TOKEN_SIGNING']}`);
        const verificationResult = await jose.jwtVerify(readToken, secret, { subject: userId });

        return verificationResult.payload?.['attrId'] === channel && verificationResult.payload?.sub === userId;
      } catch (ex) {
        request.log.warn(ex);
      }
    }

    return Fact.isAuthorizedToReadPayload(channel, userId, request.log as unknown as IsLogger);
  }

  public async verifyAuthorizedSend(
    userId: string,
    channel: string,
    request: http.IncomingMessage,
  ): Promise<boolean> {
    if (!userId) {
      return Promise.resolve(false);
    }

    return Fact.isAuthorizedToModifyPayload(channel, userId, request.log as unknown as IsLogger);
  }
}

export default async function mountServiceBus(httpServer, app) {
  // Initialize query subscription service if enabled
  const querySubscriptionService = new QuerySubscriptionService();

  const sendMessage = await clientServerBus(httpServer, app, new WSAccessControl(app), async (attributeId, change: any, request, userId) => {
    const logger = request.log as unknown as IsLogger;

    // Check if this is a query subscription message
    if (change?.type === 'subscribe_query') {
      // Handle query subscription
      try {
        const { subscriptionId, query } = change;
        querySubscriptionService.subscribe(userId, query, subscriptionId, logger);
        // Confirmation will be sent automatically by client-server-bus callback mechanism
      } catch (error) {
        logger.warn(`Error handling query subscription: ${(error as Error).message}`);
      }
      return;
    }

    if (change?.type === 'unsubscribe_query') {
      // Handle query unsubscribe
      try {
        const { subscriptionId } = change;
        querySubscriptionService.unsubscribe(subscriptionId, logger);
      } catch (error) {
        logger.warn(`Error handling query unsubscription: ${(error as Error).message}`);
      }
      return;
    }

    // Regular attribute change handling
    const attribute = getAttributeByMessage(attributeId, change, logger);

    try {
      await Quota.ensureStorageSpaceToSave(
        userId,
        [[attribute, change]],
        logger,
      );

      const committedChange: SerializedChangeWithMetadata<any> = await attribute.change(
        change,
      );

      sendMessage(attributeId, committedChange);
    } catch (ex: any) {
      if (ex.message === 'Not enough storage space available') {
        sendMessage(attributeId, { error: 'quota_violation' });
      } else {
        throw ex;
      }
    }
  });

  // Initialize subscription service with sendMessage function
  querySubscriptionService.setSendMessageFunction(sendMessage);

  // Initialize subscription hooks
  SubscriptionHooks.initialize(querySubscriptionService);
}
