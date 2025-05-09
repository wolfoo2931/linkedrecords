/* eslint-disable import/no-cycle */
import Fact from '.';
import IsLogger from '../../../lib/is_logger';
import { ResolveToAttributesResult } from '../../attributes/attribute_query';
import cache from '../../server/cache';
import { Role } from './authorization_sql_builder';
import FactBox from './fact_box';

export default class AuthCache {
  static async hasCachedAccess(
    userid: string,
    roles: Role[],
    attributeId: string,
    logger: IsLogger,
  ): Promise<boolean> {
    const roleKey = roles.sort().join(':');
    const allowedRoleCombos = this.getCachedRoleCombos(userid, attributeId);

    const cacheHit = allowedRoleCombos.includes(roleKey);

    if (cacheHit) {
      logger.info(`cache hit for access request: ${userid}, ${roles}, ${attributeId}`);
    } else {
      logger.info(`cache MISS!, ${roles}, ${allowedRoleCombos.join(' and ')}`);
    }

    return cacheHit;
  }

  static async onFactDeletion(
    fact: Fact,
    logger: IsLogger,
  ): Promise<void> {
    if (!fact.predicate.startsWith('$')) {
      return;
    }

    if (fact.subject.startsWith('us-')) {
      cache.invalidate(fact.subject);
      return;
    }

    const users = await FactBox.getAllAssociatedUsers(fact.subject, logger);
    users.forEach((uid) => cache.invalidate(uid));
  }

  private static getCachedRoleCombos(
    userid: string,
    attributeId: string,
  ) {
    const userCache = cache.get(userid) || {};

    if (!userCache[attributeId]) {
      userCache[attributeId] = [];
    }

    return userCache[attributeId];
  }

  static async cache(
    userid: string,
    roles: Role[],
    attributeId: string,
    logger: IsLogger,
  ) {
    if (!userid.startsWith('us-')) {
      throw new Error('caching access rules for non user nodes is not supported.');
    }

    logger.info(`cache access cache for: ${userid}, ${roles}, ${attributeId}`);

    const userCache = cache.get(userid) || {};
    const roleKey = roles.sort().join(':');

    if (!userCache[attributeId]) {
      userCache[attributeId] = [];
    }

    if (!userCache[attributeId].includes(roleKey)) {
      userCache[attributeId].push(roleKey);
      cache.set(userid, userCache);
    }
  }

  static async cacheQueryResult(
    actorId: string,
    result: ResolveToAttributesResult,
    logger: IsLogger,
  ) {
    if (Array.isArray(result)) {
      result.map((attr) => attr.id && AuthCache.cache(actorId, ['reader'], attr.id, logger));
    } else if (result) {
      const allResults: { id: string }[][] = Object.values(result);
      allResults.map((partialResult: any) => {
        if (Array.isArray(partialResult)) {
          return partialResult.map((attr) => AuthCache.cache(actorId, ['reader'], attr.id, logger));
        }

        if (partialResult && partialResult.id) {
          return AuthCache.cache(actorId, ['reader'], partialResult.id, logger);
        }

        return undefined;
      });
    }
  }
}
