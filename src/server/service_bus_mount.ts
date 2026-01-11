/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */
/* eslint-disable max-len */
import * as jose from 'jose';
import http from 'http';
import clientServerBus, { getAllChannels } from '../../lib/client-server-bus/server';
import IsLogger from '../../lib/is_logger';
import SerializedChangeWithMetadata from '../attributes/abstract/serialized_change_with_metadata';
import { getAttributeByMessage } from './middleware/attribute';
import Fact from '../facts/server';
import { uid } from './controllers/userinfo_controller';
import Quota from './quota';
import { CompoundAttributeQuery, isValidCompoundAttributeQuery } from '../attributes/attribute_query';

export type CompoundAttributeQuerySubscribers = {
  query: CompoundAttributeQuery,
  userIds: string[],
};

let sendMessage: (channel: string, body: any) => void;
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

    if (channel.startsWith('query-sub:')) {
      const query = channel.replace(/^query-sub:.*?:/, '').trim();

      try {
        const parsedQuery = JSON.parse(query);
        const isValid = isValidCompoundAttributeQuery(parsedQuery);

        if (!isValid) {
          request.log.warn('Invalid compound attribute query');
        }

        // as long as the query is valid every authenticated user is authorized
        // to execute the query or subscribe to it. The user will receive a result
        // set which will reflect the users authorization.
        // In the current implementation this is handled in the following way:
        // If there might be change which might match the users query subscription the
        // users client receives a simple ping and will then execute the query.
        return isValid;
      } catch (ex: any) {
        request.log.warn(`Unexpected error in verifying query subscription: ${ex?.message}`);
        return false;
      }
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

export async function getSubscribedQueries(logger: IsLogger): Promise<CompoundAttributeQuerySubscribers[]> {
  const queryUserMap: Record<string, string[]> = {};
  [...(await getAllChannels())]
    .filter((channel) => channel.startsWith('query-sub:'))
    .forEach((channel) => {
      const match = channel.replace(/^query-sub:/, '').match(/^(.*?):(.*)$/);

      if (!match || !match[1] || !match[2]) {
        logger.warn(`Unexpected error parsing query in query subscription list (could not determine user of subscription): ${channel}`);
        return;
      }

      const userId = match[1].trim();
      const queryString = match[2].trim();

      if (!queryUserMap[queryString]) {
        queryUserMap[queryString] = [];
      }

      queryUserMap[queryString].push(userId);
    });

  return Object.entries(queryUserMap).flatMap(([queryString, userIds]) => {
    try {
      const query = JSON.parse(queryString);
      return { query, userIds };
    } catch (ex) {
      logger.warn(`Unexpected error parsing query in query subscription list (could not parse query): ${queryString}`);
      return [];
    }
  });
}

export function notifyQueryResultMightHaveChanged(query: CompoundAttributeQuery, userId) {
  if (!sendMessage) {
    throw new Error('sending messages does not work yet, sendMessage is not initialized');
  }

  if (!isValidCompoundAttributeQuery(query)) {
    throw new Error(`invalid query: ${JSON.stringify(query)}`);
  }

  sendMessage(`query-sub:${userId}:${JSON.stringify(query)}`, { type: 'resultMightHaveChanged' });
}

export default async function mountServiceBus(httpServer, app) {
  sendMessage = await clientServerBus(httpServer, app, new WSAccessControl(app), async (attributeId, change, request, userId) => {
    const logger = request.log as unknown as IsLogger;
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
}
