type Role = 'term' | 'creator' | 'selfAccess';
type AnyOrAllGroups = 'any' | 'all';

const rolePredicateMap = {
  member: '$isMemberOf',
};

const anyOrAllGroupsMap = {
  any: ' UNION ',
  all: ' INTERSECT ',
};

export default class AuthorizationSqlBuilder {
  public static selectSubjectsInAnyGroup(userid: string, roles: Role[], attributeId?: string) {
    return this.getSqlToSeeSubjectsInGroups(userid, roles, 'any', attributeId);
  }

  public static selectSubjectsInAllGroup(userid: string, roles: Role[], attributeId?: string) {
    return this.getSqlToSeeSubjectsInGroups(userid, roles, 'all', attributeId);
  }

  public static getSqlToSeeSubjectsInGroups(userid: string, roles: Role[], anyOrAllGroups: AnyOrAllGroups = 'all', attributeId?: string) {
    const creatorSubSelect = roles
      .filter((role) => role === 'creator')
      .map(() => `SELECT facts.subject FROM facts WHERE facts.predicate = '$wasCreatedBy' AND facts.object = '${userid}' ${attributeId ? `AND facts.subject = '${attributeId}'` : ''}`);

    const selfSubSelect = roles
      .filter((role) => role === 'selfAccess')
      .map(() => `SELECT '${userid}'`);

    const termsSubSelect = roles
      .filter((role) => role === 'term')
      .map(() => "SELECT facts.subject FROM facts WHERE facts.predicate='$isATermFor'");

    const groupSubSelect = roles
      .filter((role) => role !== 'selfAccess' && role !== 'creator' && role !== 'term')
      .map((role) => `
        SELECT facts.subject
        FROM facts
        WHERE facts.subject IN (SELECT subject FROM facts WHERE facts.predicate='$isMemberOf')
        AND '${userid}' IN (SELECT subject FROM facts WHERE facts.predicate='${rolePredicateMap[role]}')'
        ${attributeId ? `AND facts.subject = '${attributeId}'` : ''}
      `);

    return `(${[
      ...creatorSubSelect,
      ...selfSubSelect,
      ...termsSubSelect,
      ...groupSubSelect,
    ].join(anyOrAllGroupsMap[anyOrAllGroups])})`;
  }
}
