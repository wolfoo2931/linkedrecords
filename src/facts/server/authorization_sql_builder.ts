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
  public static getSQLToCheckAccess(userid: string, roles: Role[], attributeId: string) {
    return `(SELECT *
      FROM (${this.selectSubjectsInAnyGroup(userid, roles)}) as facts
      WHERE node='${attributeId}')`;
  }

  public static selectSubjectsInAnyGroup(userid: string, roles: Role[]) {
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
      // TODO: we can cache this and include the list
      const allGroupsOfTheUser = `SELECT object FROM facts as member_facts WHERE member_facts.subject = '${userid}' AND member_facts.predicate IN ('$isHostOf', '$isMemberOf', '$isAccountableFor')`;

      groupSubSelect.push(`SELECT
        object as node
        FROM facts
        WHERE predicate IN (${groupRoles.join(',')})
        AND (subject='${userid}' OR subject IN (${allGroupsOfTheUser}))`);
    }

    return `(${[
      ...selfSubSelect,
      ...termsSubSelect,
      ...groupSubSelect,
    ].join(' UNION ')})`;
  }
}
