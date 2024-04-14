export type Role = 'term' | 'creator' | 'selfAccess' | 'host' | 'member';

export const rolePredicateMap = {
  member: '$isMemberOf',
  host: '$isHostOf',
  creator: '$isAccountableFor',
};

export default class AuthorizationSqlBuilder {
  public static selectSubjectsInAnyGroup(userid: string, roles: Role[]) {
    return this.getSqlToSeeSubjectsInGroups(userid, roles);
  }

  public static getSQLToCheckAccess(userid: string, roles: Role[], attributeId: string) {
    return `(SELECT *
      FROM (${this.getSqlToSeeSubjectsInGroups(userid, roles)}) as facts
      WHERE subject='${attributeId}')`;
  }

  public static getSqlToSeeSubjectsInGroups(userid: string, roles: Role[]) {
    const selfSubSelect = roles
      .filter((role) => role === 'selfAccess')
      .map(() => `SELECT '${userid}' as subject`);

    const termsSubSelect = roles
      .filter((role) => role === 'term')
      .map(() => "SELECT facts.subject FROM facts WHERE facts.predicate='$isATermFor'");

    const groupRoles = roles
      .filter((role) => Object.keys(rolePredicateMap).includes(role))
      .map((r) => `'${rolePredicateMap[r]}'`);

    const groupSubSelect: string[] = [];

    if (groupRoles.length) {
      // TODO: we can cache this and include the list
      // of groups in the sub query instead of the select??
      const allGroupsOfTheUser = `SELECT object FROM facts as f WHERE f.subject = '${userid}' AND f.predicate IN (${groupRoles.join(',')})`;

      groupSubSelect.push(
        `SELECT subject
          FROM facts
          WHERE facts.predicate='$isMemberOf'
          AND facts.object in (${allGroupsOfTheUser})`,
      );
      groupSubSelect.push(
        `SELECT object
          FROM facts
          WHERE facts.predicate='$isAccountableFor'
          AND facts.subject in (${allGroupsOfTheUser})`,
      );
      groupSubSelect.push(
        `SELECT object
          FROM facts
          WHERE facts.object in (${allGroupsOfTheUser})`,
      );
    }

    return `(${[
      ...selfSubSelect,
      ...termsSubSelect,
      ...groupSubSelect,
    ].join(' UNION ')})`;
  }
}
