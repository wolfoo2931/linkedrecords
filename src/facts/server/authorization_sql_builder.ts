type Role = 'term' | 'creator' | 'selfAccess' | 'host' | 'member';
type AnyOrAllGroups = 'any' | 'all';

export const rolePredicateMap = {
  member: '$isMemberOf',
  host: '$isHostOf',
};

const anyOrAllGroupsMap = {
  any: ' UNION ',
  all: ' INTERSECT ',
};

export default class AuthorizationSqlBuilder {
  public static selectSubjectsInAnyGroup(userid: string, roles: Role[], attributeId?: string) {
    return this.getSqlToSeeSubjectsInGroups(userid, roles, 'any', attributeId);
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

    const groupRoles = roles
      .filter((role) => Object.keys(rolePredicateMap).includes(role))
      .map((r) => `'${rolePredicateMap[r]}'`);

    const groupSubSelect: string[] = [];

    if (groupRoles.length) {
      if (attributeId) {
        groupSubSelect.push(
          `SELECT subject FROM facts
           WHERE facts.subject = '${userid}'
           AND facts.predicate IN (${groupRoles.join(',')})
           AND facts.object = '${attributeId}'`,
        );
        groupSubSelect.push(
          `SELECT subject FROM facts
           WHERE facts.predicate='$isMemberOf'
           AND facts.object in (SELECT object FROM facts as f WHERE f.subject = '${userid}' AND f.predicate IN (${groupRoles.join(',')}))
           AND facts.subject = '${attributeId}'`,
        );
      } else {
        // TODO: this will not work if it will be joined with anyOrAllGroupsMap['all']
        groupSubSelect.push(
          `SELECT subject FROM facts
           WHERE facts.predicate='$isMemberOf'
           AND facts.object in (SELECT object FROM facts as f WHERE f.subject = '${userid}' AND f.predicate IN (${groupRoles.join(',')}))`,
        );
        groupSubSelect.push(
          `SELECT subject FROM facts
           WHERE facts.subject in (SELECT object FROM facts as f WHERE f.subject = '${userid}' AND f.predicate IN (${groupRoles.join(',')}))`,
        );
      }
    }

    return `(${[
      ...creatorSubSelect,
      ...selfSubSelect,
      ...termsSubSelect,
      ...groupSubSelect,
    ].join(anyOrAllGroupsMap[anyOrAllGroups])})`;
  }
}
