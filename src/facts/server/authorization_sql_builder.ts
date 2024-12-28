import IsLogger from '../../../lib/is_logger';
import PgPoolWithLog from '../../../lib/pg-log';

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

export default class AuthorizationSqlBuilder {
  public static async getSQLToCheckAccess(
    userid: string,
    roles: Role[],
    attributeId: string,
    logger: IsLogger,
  ) {
    return `(SELECT *
      FROM (${await this.selectSubjectsInAnyGroup(userid, roles, attributeId, logger)}) as facts
      WHERE node='${attributeId}')`;
  }

  public static async selectSubjectsInAnyGroup(
    userid: string,
    roles: Role[],
    attributeId: string | undefined,
    logger: IsLogger,
  ) {
    const selfSubSelect = roles
      .filter((role) => role === 'selfAccess')
      .map(() => `SELECT '${userid}' as node`);

    const termsSubSelect = roles
      .filter((role) => role === 'term')
      .map(() => "SELECT facts.subject as node FROM facts WHERE facts.predicate='$isATermFor'");

    const groupRoles = roles
      .filter((role) => Object.keys(rolePredicateMap).includes(role))
      .map((r) => `'${rolePredicateMap[r]}'`);

    const groupSubSelect: string[] = [];

    if (groupRoles.length) {
      const allDirectAccessibleNodeMembers = `SELECT
        object as node
        FROM facts
        WHERE predicate IN (${groupRoles.join(',')})
        AND subject IN (${await this.getGroupsOfTheUser(userid, logger)})`;

      const allDirectAccessibleNode = allDirectAccessibleNodeMembers + (attributeId ? ` AND object='${attributeId}'` : '');

      groupSubSelect.push(`
        (WITH
          direct_accessible_nodes AS (${allDirectAccessibleNode}),
          direct_accessible_node_members AS (${allDirectAccessibleNodeMembers})

          SELECT node FROM direct_accessible_nodes
        UNION ALL
          SELECT subject as node FROM facts WHERE predicate='$isMemberOf' AND object IN (SELECT node FROM direct_accessible_node_members))
      `);
    }

    return `(${[
      ...selfSubSelect,
      ...termsSubSelect,
      ...groupSubSelect,
    ].join(' UNION ALL ')})`;
  }

  public static async getGroupsOfTheUser(userid: string, logger: IsLogger) {
    const pgPool = new PgPoolWithLog(logger);
    const query = `SELECT '${userid}' as object UNION ALL SELECT object FROM facts as member_facts WHERE member_facts.subject = '${userid}' AND member_facts.predicate IN ('$isHostOf', '$isMemberOf', '$isAccountableFor')`;
    const result = await pgPool.query(query);

    if (result.rows.length > 300) {
      return query;
    }

    return result.rows
      .map((r) => r.object)
      .map((r) => `'${r}'`)
      .join(',');
  }
}
