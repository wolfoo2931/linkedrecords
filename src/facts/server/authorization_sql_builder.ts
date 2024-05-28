export type Role = 'term' | 'creator' | 'selfAccess' | 'host' | 'member' | 'access' | 'reader' | 'referer';

export const rolePredicateMap = {
  member: '$isMemberOf',
  host: '$isHostOf',
  creator: '$isAccountableFor',
  reader: '$canRead',
  referer: '$canReferTo',
  access: '$canAccess',
};

export default class AuthorizationSqlBuilder {
  public static selectSubjectsInAnyGroup(userid: string, roles: Role[]) {
    return this.getSqlToSeeSubjectsInGroups(userid, roles);
  }

  public static getSQLToCheckAccess(userid: string, roles: Role[], attributeId: string) {
    return `(SELECT *
      FROM (${this.getSqlToSeeSubjectsInGroups(userid, roles)}) as facts
      WHERE node='${attributeId}')`;
  }

  public static getSqlToSeeSubjectsInGroups(userid: string, roles: Role[]) {
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

    // TODO: the access relations are ordinal:
    // '$isAccountableFor' > '$isHostOf' > '$isMemberOf' > '$canReferTo' > '$canRead'
    // we can make use of this by creating an access table where we save the strongest relation
    // as an mapped integer and use a B-Tree index.
    if (groupRoles.length) {
      // TODO: we can cache this and include the list
      const allGroupsOfTheUser = `SELECT object FROM facts as member_facts WHERE member_facts.subject = '${userid}' AND member_facts.predicate IN ('$isHostOf', '$isMemberOf', '$isAccountableFor')`;
      groupSubSelect.push(`SELECT object as node FROM facts WHERE predicate IN (${groupRoles.join(',')}) AND (subject='${userid}' OR subject IN (${allGroupsOfTheUser}))`);
    }

    return `(${[
      ...selfSubSelect,
      ...termsSubSelect,
      ...groupSubSelect,
    ].join(' UNION ')})`;
  }
}
