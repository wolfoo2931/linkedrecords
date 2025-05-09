/* eslint-disable import/no-cycle */
import Fact from '.';
import IsLogger from '../../../lib/is_logger';
import cache from '../../server/cache';
import { Role } from './authorization_sql_builder';

export default class AuthCache {
  static async hasCachedAccess(
    userid: string,
    roles: Role[],
    attributeId: string,
    logger: IsLogger,
  ) {
    logger.info(`cache access cache for: ${userid}, ${roles}, ${attributeId}`);

    const roleKey = roles.sort().join(':');
    const allowedRoleCombos = this.getCachedRoleCombos(userid, attributeId);

    return allowedRoleCombos.includes(roleKey);
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
    }

    // TODO
    // FIND test cases
  }

  private static getCachedRoleCombos(
    userid: string,
    attributeId: string,
  ) {
    const rawUserCache = cache.get(userid);
    const userCache = rawUserCache ? JSON.parse(rawUserCache) : {};

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

    const rawUserCache = cache.get(userid);
    const userCache = rawUserCache ? JSON.parse(rawUserCache) : {};
    const roleKey = roles.sort().join(':');

    if (!userCache[attributeId]) {
      userCache[attributeId] = [];
    }

    if (!userCache[attributeId].includes(roleKey)) {
      userCache[attributeId].push(roleKey);
      cache.set(userid, JSON.stringify(userCache));
    }
  }
}
