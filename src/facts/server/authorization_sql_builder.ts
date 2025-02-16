// eslint-disable-next-line import/no-cycle
import Fact from '.';
import IsLogger from '../../../lib/is_logger';
import EnsureIsValid from '../../../lib/utils/sql_values';

export type Role = 'term' | 'creator' | 'selfAccess' | 'host' | 'member' | 'access' | 'reader' | 'referer' | 'conceptor';

export const rolePredicateMap = {
  member: '$isMemberOf',
  host: '$isHostOf',
  creator: '$isAccountableFor',
  reader: '$canRead',
  referer: '$canReferTo',
  access: '$canAccess',
  conceptor: '$canRefine',
};

type MembershipType = 'all' | 'directUser';

export default class AuthorizationSqlBuilder {
  public static async getSQLToCheckAccess(
    userid: string,
    roles: Role[],
    attributeId: string,
    logger: IsLogger,
  ) {
    return `(
        SELECT *
        FROM (${await AuthorizationSqlBuilder.selectSubjectsInAnyGroup(userid, roles, attributeId, logger, 'directUser')}) as facts
        WHERE node='${EnsureIsValid.nodeId(attributeId)}'
      UNION ALL
        SELECT *
        FROM (${await AuthorizationSqlBuilder.selectSubjectsInAnyGroup(userid, roles, attributeId, logger, 'all')}) as facts
        WHERE node='${EnsureIsValid.nodeId(attributeId)}'
      )`;
  }

  public static async selectSubjectsInAnyGroup(
    userid: string,
    roles: Role[],
    attributeId: string | undefined,
    logger: IsLogger,
    membershipType: MembershipType = 'all',
  ) {
    const selfSubSelect = roles
      .filter((role) => role === 'selfAccess')
      .map(() => `SELECT '${EnsureIsValid.userId(userid)}' as node`);

    const termsSubSelect = roles
      .filter((role) => role === 'term')
      .map(() => "SELECT facts.subject as node FROM facts WHERE facts.predicate='$isATermFor' AND facts.fact_box_id=0");

    const groupRoles = roles
      .filter((role) => Object.keys(rolePredicateMap).includes(role))
      .map(EnsureIsValid.predicate)
      .map((r) => `'${rolePredicateMap[r]}'`);

    const groupSubSelect: string[] = [];

    if (groupRoles.length) {
      const factScope = await Fact.getFactScopeByUser(userid, logger);

      const allDirectAccessibleNodeMembers = `SELECT
        object as node
        FROM facts
        WHERE predicate IN (${groupRoles.join(',')})
        AND fact_box_id IN (${factScope.factBoxIds.map(EnsureIsValid.factBoxId).join(',')})
        AND subject IN (${await this.getGroupsOfTheUser(userid, membershipType, factScope)})`;

      const allDirectAccessibleNode = allDirectAccessibleNodeMembers + (attributeId ? ` AND object='${EnsureIsValid.object(attributeId)}'` : '');

      groupSubSelect.push(`
        (WITH
          direct_accessible_nodes AS (${allDirectAccessibleNode}),
          direct_accessible_node_members AS (${allDirectAccessibleNodeMembers})

          SELECT node FROM direct_accessible_nodes
        UNION ALL
          SELECT subject as node
          FROM facts
          WHERE predicate='$isMemberOf'
          AND fact_box_id IN (${factScope.factBoxIds.map(EnsureIsValid.factBoxId).join(',')})
          AND object IN (SELECT node FROM direct_accessible_node_members))
      `);
    }

    return `(${[
      ...selfSubSelect,
      ...termsSubSelect,
      ...groupSubSelect,
    ].join(' UNION ALL ')})`;
  }

  public static async getGroupsOfTheUser(
    userid: string,
    membershipType: MembershipType,
    factScope: { internalUserId: number, factBoxIds: number[] },
  ) {
    if (membershipType === 'directUser') {
      return `'${userid}'`;
    }

    const factScopeFilter = factScope
      ? ` AND member_facts.fact_box_id IN (${factScope.factBoxIds.map(EnsureIsValid.factBoxId).join(',')})`
      : '';

    return `SELECT '${EnsureIsValid.userId(userid)}' as object UNION ALL SELECT object FROM facts as member_facts WHERE member_facts.subject = '${EnsureIsValid.userId(userid)}' AND member_facts.predicate IN ('$isHostOf', '$isMemberOf', '$isAccountableFor')${factScopeFilter}`;
  }
}
