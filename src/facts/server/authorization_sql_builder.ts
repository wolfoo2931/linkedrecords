export type Role = 'term' | 'creator' | 'selfAccess' | 'host' | 'member';

export const rolePredicateMap = {
  member: '$isMemberOf',
  host: '$isHostOf',
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
    const creatorSubSelect = roles
      .filter((role) => role === 'creator')
      .map(() => `SELECT facts.subject FROM facts WHERE facts.predicate = '$wasCreatedBy' AND facts.object = '${userid}'`);

    const selfSubSelect = roles
      .filter((role) => role === 'selfAccess')
      .map(() => `SELECT '${userid}'`);

    const termsSubSelect = roles
      .filter((role) => role === 'term')
      .map(() => "SELECT facts.subject FROM facts WHERE facts.predicate='$isATermFor'");

    const groupRoles = roles
      .filter((role) => Object.keys(rolePredicateMap).includes(role))
      .map((r) => `'${rolePredicateMap[r]}'`);

    const groupSubSelect: string[] = [];

    if (groupRoles.length) {
      groupSubSelect.push(
        `SELECT subject FROM facts
          WHERE facts.predicate='$isMemberOf'
          AND facts.object in (SELECT object FROM facts as f WHERE f.subject = '${userid}' AND f.predicate IN (${groupRoles.join(',')}))`, // we do not have the wasCreatedBy objects here
      );
      groupSubSelect.push(
        `SELECT subject FROM facts
          WHERE facts.subject in (SELECT object FROM facts as f WHERE f.subject = '${userid}' AND f.predicate IN (${groupRoles.join(',')}))`, // we do not have the wasCreatedBy objects here
      );
    }

    return `(${[
      ...creatorSubSelect,
      ...selfSubSelect,
      ...termsSubSelect,
      ...groupSubSelect,
    ].join(' UNION ')})`;
  }
}
