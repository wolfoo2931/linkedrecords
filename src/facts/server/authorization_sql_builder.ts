export type Role = 'term' | 'creator' | 'selfAccess' | 'host' | 'member' | 'reader' | 'referer';

export const rolePredicateMap = {
  member: '$isMemberOf',
  host: '$isHostOf',
  creator: '$isAccountableFor',
  reader: '$canRead',
  referer: '$canReferTo',
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

    const groupRolesWithoutMemberNodes = groupRoles.filter((c) => c !== "'$isMemberOf'");
    const groupSubSelect: string[] = [];

    // TODO: the access relations are ordinal:
    // '$isAccountableFor' > '$isHostOf' > '$isMemberOf' > '$canReferTo' > '$canRead'
    // we can make use of this by creating an access table where we save the strongest relation
    // as an mapped integer and use a B-Tree index.
    if (groupRoles.length) {
      // TODO: we can cache this and include the list
      const allGroupsOfTheUser = `SELECT object FROM facts as member_facts WHERE member_facts.subject = '${userid}' AND member_facts.predicate IN ('$isHostOf', '$isMemberOf', '$isAccountableFor')`; // FIXME: all roles here ??
      const allNodesInGroups = `SELECT subject as node FROM facts WHERE predicate IN (${groupRoles.join(',')}) AND object IN (${allGroupsOfTheUser})`;

      // TODO: replace '$isMemberOf' with '$canAccess' to add attributes to a group
      // and only use $isMemberOf to add users to a group
      if (groupRoles.includes('$isMemberOf')) {
        groupSubSelect.push(`SELECT subject as node FROM facts WHERE predicate='$isMemberOf' AND object IN (${allGroupsOfTheUser})`);
      }

      if (groupRolesWithoutMemberNodes.length) {
        groupSubSelect.push(`SELECT object as node FROM facts WHERE predicate IN (${groupRolesWithoutMemberNodes.join(',')}) AND subject IN (${allGroupsOfTheUser})`);
      }

      groupSubSelect.push(`SELECT object as node FROM facts WHERE subject='${userid}' AND predicate IN (${groupRoles.join(',')})`);

      groupSubSelect.push(allNodesInGroups);
    }

    return `(${[
      ...selfSubSelect,
      ...termsSubSelect,
      ...groupSubSelect,
    ].join(' UNION ')})`;
  }
}
