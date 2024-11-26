/* eslint-disable import/no-cycle */
/* eslint-disable no-plusplus */
import md5 from 'md5';
import { FactQuery, SubjectQueries, SubjectQuery } from '../fact_query';
import PgPoolWithLog from '../../../lib/pg-log';
import IsLogger from '../../../lib/is_logger';
import AuthorizationError from '../../attributes/errors/authorization_error';
import SQL, { rolePredicateMap } from './authorization_sql_builder';

function andFactory(): () => 'WHERE' | 'AND' {
  let whereUsed = false;

  return () => {
    if (!whereUsed) {
      whereUsed = true;
      return 'WHERE';
    }

    return 'AND';
  };
}

function hasNotModifier(statement: SubjectQuery): boolean {
  if (!Array.isArray(statement) || !statement[1]) {
    return false;
  }

  return !!statement[1].match(/^\$not\(.+\)$/);
}

function hasLatestModifier(statement: SubjectQuery): boolean {
  if (!Array.isArray(statement) || !statement[1]) {
    return false;
  }

  return !!statement[0].match(/^\$latest\(.+\)$/);
}

function ensureValidFactQuery({ subject, predicate, object }: FactQuery) {
  const isSubjectEmpty = !subject || subject.length === 0;
  const isObjectEmpty = !object || object.length === 0;
  const isPredicateEmpty = !predicate || predicate.length === 0;
  const isValidId = (p) => typeof p === 'string' && p.match(/^[a-zA-Z0-9-]+$/);
  const isValidPredicate = (p) => typeof p === 'string' && p.match(/^\$?[a-zA-Z0-9-()]+\*?$/);
  const isValidSubject = (p) => typeof p === 'string' && p.match(/^\$?[a-zA-Z0-9-()]+$/);

  if (isSubjectEmpty && isObjectEmpty && isPredicateEmpty) {
    throw new Error('invalid FactQuery, provide at least one of the following conditions: subject, predicate, object');
  }

  if (predicate && !Array.isArray(predicate)) {
    throw new Error('invalid FactQuery, predicate must be an array of strings!');
  }

  if (predicate && predicate.find((p) => !isValidPredicate(p))) {
    throw new Error(`invalid predicate in query: ${predicate}`);
  }

  [...(subject || []), ...(object || [])].forEach((sq) => {
    if (typeof sq === 'string') {
      if (!isValidId(sq)) {
        throw new Error(`invalid Id in subject query: ${sq}`);
      }
    } else if (Array.isArray(sq)) {
      if (sq.length === 3 && !isValidSubject(sq[0])) {
        throw new Error(`invalid subject part in fact query detected: ${sq[0]}`);
      }

      if (sq.length === 2 && !isValidPredicate(sq[0])) {
        throw new Error(`invalid predicate part in fact query detected: ${sq[0]}`);
      }

      if (!isValidSubject(sq[1])) {
        throw new Error(`invalid predicate part in fact query detected: ${sq[1]}`);
      }

      if (sq[2] && sq[2] !== '$it') {
        throw new Error(`invalid object part in fact query detected: ${sq[2]}`);
      }

      if (sq.length > 3) {
        throw new Error('invalid array length in query detected');
      }
    } else {
      throw new Error('subject query needs to be array or string');
    }
  });

  return true;
}

export default class Fact {
  static reservedPredicates = [
    '$isATermFor',
    '$isAccountableFor',
    '$isMemberOf',
    '$isHostOf',
    '$canRead',
    '$canReferTo',
    '$canAccess',
    '$canRefine',
  ];

  subject: string;

  predicate: string;

  object: string;

  logger: IsLogger;

  static async initDB() {
    const pg = new PgPoolWithLog(console as unknown as IsLogger);

    await pg.query(`
      CREATE TABLE IF NOT EXISTS facts (id SERIAL, subject CHAR(40), predicate CHAR(40), object TEXT, created_at timestamp DEFAULT NOW(), created_by CHAR(40));
      CREATE TABLE IF NOT EXISTS deleted_facts (subject CHAR(40), predicate CHAR(40), object TEXT, deleted_at timestamp DEFAULT NOW(), deleted_by CHAR(40));
      CREATE TABLE IF NOT EXISTS users (_id SERIAL, id CHAR(40), hashed_email CHAR(40), username CHAR(40));
      CREATE TABLE IF NOT EXISTS kv_attributes (id UUID, actor_id varchar(36), updated_at TIMESTAMP, created_at TIMESTAMP, value TEXT);
      CREATE TABLE IF NOT EXISTS bl_attributes (id UUID, actor_id varchar(36), updated_at TIMESTAMP, created_at TIMESTAMP, value TEXT);
      CREATE INDEX IF NOT EXISTS idx_facts_subject ON facts (subject);
      CREATE INDEX IF NOT EXISTS idx_facts_predicate ON facts (predicate);
      CREATE INDEX IF NOT EXISTS idx_facts_object ON facts (object);
      CREATE INDEX IF NOT EXISTS idx_kv_attr_id ON kv_attributes (id);
      ALTER TABLE facts ALTER COLUMN subject SET NOT NULL;
      ALTER TABLE facts ALTER COLUMN predicate SET NOT NULL;
      ALTER TABLE facts ALTER COLUMN object SET NOT NULL;
    `);
  }

  public static async getUserIdByEmail(
    email: string,
    logger:
    IsLogger,
  ): Promise<string | undefined> {
    const pool = new PgPoolWithLog(logger);
    const users = await pool.query('SELECT id FROM users WHERE hashed_email = $1', [md5(email)]);

    if (users.rows.length === 1) {
      return users.rows[0].id.trim();
    }

    return undefined;
  }

  public static async recordUserEmail(email: string, userid: string, logger: IsLogger) {
    const pool = new PgPoolWithLog(logger);

    if (!(await Fact.getUserIdByEmail(email, logger))) {
      await pool.query('INSERT INTO users (id, hashed_email, username) VALUES ($1, $2, $3)', [userid, md5(email), email]);
    }
  }

  public static async isAuthorizedToModifyPayload(
    nodeId: string, // where nodeId is in most cases an attributeId
    userid: string,
    logger: IsLogger,
  ): Promise<boolean> {
    const pool = new PgPoolWithLog(logger);

    return pool.findAny(SQL.getSQLToCheckAccess(
      userid,
      ['creator', 'host', 'member', 'access'],
      nodeId,
    ));
  }

  public static async isAuthorizedToReadPayload(
    nodeId: string, // where nodeId is in most cases an attributeId
    userid: string,
    logger: IsLogger,
  ): Promise<boolean> {
    const pool = new PgPoolWithLog(logger);
    const res = await pool.findAny(SQL.getSQLToCheckAccess(
      userid,
      ['creator', 'host', 'member', 'access', 'reader'],
      nodeId,
    ));

    return res;
  }

  private static authorizedSelect(userid: string) {
    if (!userid || !userid.match(/^us-[a-f0-9]{32}$/gi)) {
      throw new Error(`userId is invalid: "${userid}"`);
    }

    const authorizedNodes = SQL.selectSubjectsInAnyGroup(
      userid,
      ['selfAccess', 'creator', 'host', 'member', 'access', 'reader'],
    );

    const authorizedTerms = SQL.selectSubjectsInAnyGroup(userid, ['term']);

    return `WITH auth_nodes AS (${authorizedNodes}),
    auth_facts AS (
    SELECT id, subject, predicate, object FROM facts WHERE predicate='$isATermFor'
    UNION ALL
    SELECT id, subject, predicate, object
    FROM facts
    WHERE subject IN (SELECT node FROM auth_nodes)
    AND object IN (SELECT node FROM auth_nodes UNION ALL ${authorizedTerms}))
    SELECT  subject, predicate, object FROM auth_facts
    `;
  }

  private static getSQLToResolvePossibleTransitiveQuery(
    query: SubjectQuery,
    sqlPrefix: string,
  ): string | string[] {
    const predicatedAllowedToQueryAnyObjects = ['$isATermFor'];

    if (typeof query === 'string') {
      return `SELECT '${query}'`;
    }

    if (!query || !query.length || query.length !== 2) {
      throw new Error('resolveToSubjectIds must be string or array with two elements');
    }

    if (query[1] === '$anything' && query[0] && predicatedAllowedToQueryAnyObjects.includes(query[0])) {
      return `SELECT subject FROM facts WHERE predicate='${query[0]}' ${sqlPrefix ? `AND ${sqlPrefix}` : ''}`;
    }

    if (query[1] === '$anything') {
      throw new Error(`$anything selector is only allowed in context of the following predicates: ${predicatedAllowedToQueryAnyObjects.join(', ')}`);
    }

    let table = `(SELECT facts.subject, facts.predicate, facts.object FROM facts
                  WHERE object = '${query[1]}'
                  AND predicate = '${query[0]}') as f`;

    if (query[0].endsWith('*')) {
      table = `(WITH RECURSIVE rfacts AS (
        SELECT facts.subject, facts.predicate, facts.object FROM facts
                        WHERE object = '${query[1]}'
                        AND predicate = '${query[0]}'
        UNION ALL
          SELECT facts.subject, facts.predicate, facts.object FROM facts, rfacts
                          WHERE facts.object = rfacts.subject
                          AND facts.predicate = '${query[0]}'
        )
        CYCLE subject
          SET cycl TO 'Y' DEFAULT 'N'
        USING path_array
        SELECT rfacts.subject, rfacts.predicate, rfacts.object
          FROM rfacts
          WHERE cycl = 'N') as f`;
    }

    const condition = [sqlPrefix]
      .filter((c) => c.trim())
      .join(' AND ');

    return `SELECT subject FROM ${table} ${condition ? `WHERE ${condition}` : ''}`;
  }

  private static getSQLToResolveToSubjectIdsWithModifiers(
    subjectQueries: SubjectQueries,
  ): string {
    const transitiveQueries: SubjectQuery[] = [];
    const sqlConditions: [string, string, string][] = [];
    let sqlPrefix = '';

    subjectQueries.forEach((query) => {
      if (!hasNotModifier(query) && !hasLatestModifier(query)) {
        transitiveQueries.push(query);
      } else if (hasNotModifier(query) && !hasLatestModifier(query)) {
        const object = query[1].match(/^\$not\(([a-zA-Z0-9-]+)\)$/)![1];

        if (object) {
          sqlConditions.push(['subject', 'NOT IN', `(SELECT subject from facts WHERE predicate='${query[0]}' AND object='${object}')`]);
        }
      } else if (!hasNotModifier(query) && hasLatestModifier(query)) {
        const predicate = query[0].match(/^\$latest\(([a-zA-Z]+)\)$/)![1];
        if (predicate) {
          sqlConditions.push(['subject', 'IN', `(SELECT subject FROM facts WHERE id IN (SELECT max(id) FROM facts WHERE predicate='${predicate}' GROUP BY subject) AND object='${query[1]}')`]);
        }
      } else if (hasNotModifier(query) && hasLatestModifier(query)) {
        const predicate = query[0].match(/^\$latest\(([a-zA-Z]+)\)$/)![1];
        const object = query[1].match(/^\$not\(([a-zA-Z]+)\)$/)![1];

        if (predicate && object) {
          sqlConditions.push(['subject', 'IN', `(SELECT
            subject
            FROM auth_facts
            WHERE (object != '${object}' AND id IN (SELECT max(id) FROM auth_facts WHERE predicate='${predicate}' GROUP BY subject))
            OR subject NOT IN (SELECT subject FROM auth_facts WHERE predicate='${predicate}'))`]);
        }
      }
    });

    if (sqlConditions.length) {
      sqlPrefix = `${sqlConditions
        .map((x) => x.join(' '))
        .join(' AND ')
        .trim()}`;
    }

    return transitiveQueries
      .map((subjectQuery) => Fact.getSQLToResolvePossibleTransitiveQuery(
        subjectQuery,
        sqlPrefix,
      ))
      .join(' INTERSECT ');
  }

  static async saveAllWithoutAuthCheck(facts: Fact[], userid: string, logger: IsLogger) {
    if (facts.length === 0) return;

    const specialFacts = facts.filter((fact) => fact.hasSpecialCreationLogic());
    const nonSpecialFacts = facts.filter((fact) => !fact.hasSpecialCreationLogic());

    for (let i = 0; i < specialFacts.length; i += 1) {
      // we need to create this one by one to make sure no
      // duplicates gets inserted and other checks pass.
      // eslint-disable-next-line no-await-in-loop
      await specialFacts[i]?.save(userid);
    }

    await this.saveAllWithoutAuthCheckAndSpecialTreatment(nonSpecialFacts, userid, logger);
  }

  static async saveAllWithoutAuthCheckAndSpecialTreatment(
    facts: Fact[],
    userid: string,
    logger: IsLogger,
  ) {
    if (facts.length === 0) return;

    const pool = new PgPoolWithLog(logger);

    const values = facts
      .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
      .join(', ');

    const flatParams = facts.flatMap((fact) => [
      fact.subject,
      fact.predicate,
      fact.object,
      userid,
    ]);

    if (values.length) {
      await pool.query(
        `INSERT INTO facts (subject, predicate, object, created_by) VALUES ${values}`,
        flatParams,
      );
    }
  }

  static async findAll(
    {
      subject, predicate, object, subjectBlacklist, objectBlacklist,
    }: FactQuery,
    userid: string,
    logger: IsLogger,
  ): Promise<Fact[]> {
    ensureValidFactQuery({ subject, predicate, object });

    const pool = new PgPoolWithLog(logger);
    const and = andFactory();

    let sqlQuery = Fact.authorizedSelect(userid);

    if (subject) {
      sqlQuery += ` ${and()} subject IN (${Fact.getSQLToResolveToSubjectIdsWithModifiers(subject)})`;
    }

    if (predicate) {
      sqlQuery += ` ${and()} predicate='${predicate}'`;
    }

    if (object) {
      sqlQuery += ` ${and()} object IN (${Fact.getSQLToResolveToSubjectIdsWithModifiers(object)})`;
    }

    if (subjectBlacklist && subjectBlacklist.length) {
      const bl = subjectBlacklist
        .map(([s, p]) => (`SELECT object FROM facts where subject='${s}' AND predicate='${p}'`))
        .join(' UNION ');
      sqlQuery += ` ${and()} subject NOT IN (${bl})`;
    }

    if (objectBlacklist && objectBlacklist.length) {
      const bl = objectBlacklist
        .map(([s, p]) => (`SELECT object FROM facts where subject='${s}' AND predicate='${p}'`))
        .join(' UNION ');
      sqlQuery += ` ${and()} object NOT IN (${bl})`;
    }

    const result = await pool.query(sqlQuery);

    return result.rows.map((row) => new Fact(
      row.subject.trim(),
      row.predicate.trim(),
      row.object.trim(),
      logger,
    ));
  }

  constructor(subject: string, predicate: string, object: string, logger: IsLogger) {
    this.subject = subject.trim();
    this.predicate = predicate.trim();
    this.object = object.trim();
    this.logger = logger;

    this.ensureValidSyntax();
  }

  toJSON() {
    return {
      subject: this.subject,
      predicate: this.predicate,
      object: this.object,
    };
  }

  ensureValidSyntax() {
    if (!this.hasValidSubject()
      || !this.hasValidPredicate()
      || !this.hasValidObject()) {
      throw new Error(`Invalid Fact, it contains invalid charters: ${this.subject}, ${this.predicate}, ${this.object}`);
    }
  }

  hasValidSubject() {
    return typeof this.subject === 'string'
      && this.subject.match(/^[a-zA-Z0-9-]+$/)
      && this.subject.length <= 40;
  }

  hasValidPredicate() {
    return typeof this.predicate === 'string'
      && this.predicate.match(/^\$?[a-zA-Z0-9-]+\*?$/)
      && this.predicate.length <= 40;
  }

  hasValidObject() {
    return typeof this.object === 'string'
      && this.object.match(/^[a-zA-Z0-9-\s]+$/)
      && this.object.length <= 500;
  }

  async save(userid: string) {
    this.ensureValidSyntax();

    if (!(await this.isAuthorizedToSave(userid))) {
      throw new AuthorizationError(userid, 'fact', this, this.logger);
    }

    const pool = new PgPoolWithLog(this.logger);

    if (this.predicate === '$isATermFor') {
      const dbRows = await pool.query('SELECT subject FROM facts WHERE subject=$1 OR object=$1 OR subject=$2', [this.subject, this.object]);

      if (!dbRows.rows.length) {
        if (!userid) {
          throw new Error('In order to save a $isATermFor fact a userid has to be provided as a parameter of the fact.save method.');
        }

        await pool.query('INSERT INTO facts (subject, predicate, object, created_by) VALUES ($1, $2, $3, $5), ($5, $4, $1, NULL)', [
          this.subject,
          this.predicate,
          this.object,
          '$isAccountableFor',
          userid,
        ]);
      }
    } else if (this.predicate === '$isAccountableFor') {
      const dbRows = await pool.query('SELECT subject, predicate, object FROM facts WHERE object=$1 AND predicate=$2', [this.object, this.predicate]);

      if (dbRows.rows.length) {
        for (let index = 0; index < dbRows.rows.length; index++) {
          const r = dbRows.rows[index];
          const oldFact = new Fact(r.subject, r.predicate, r.object, this.logger);
          // eslint-disable-next-line no-await-in-loop
          await oldFact.deleteWithoutAuthCheck(userid);
        }
      }

      await pool.query('INSERT INTO facts (subject, predicate, object, created_by) VALUES ($1, $2, $3, $4)', [
        this.subject,
        this.predicate,
        this.object,
        userid,
      ]);
    } else {
      await pool.query('INSERT INTO facts (subject, predicate, object, created_by) VALUES ($1, $2, $3, $4)', [
        this.subject,
        this.predicate,
        this.object,
        userid,
      ]);
    }
  }

  async delete(userid: string) {
    if (!(await this.isAuthorizedToDelete(userid))) {
      throw new AuthorizationError(userid, 'fact', this, this.logger);
    }

    return this.deleteWithoutAuthCheck(userid);
  }

  private hasSpecialCreationLogic() {
    return this.predicate === '$isATermFor' || this.predicate === '$isAccountableFor';
  }

  private async deleteWithoutAuthCheck(userid: string) {
    const pool = new PgPoolWithLog(this.logger);

    await pool.query(`WITH deleted_rows AS (
        DELETE FROM facts
        WHERE subject = $1 AND predicate = $2 AND object = $3
        RETURNING *
    )
    INSERT INTO deleted_facts (subject, predicate, object, deleted_by)
    SELECT subject, predicate, object, $4 FROM deleted_rows;`, [
      this.subject,
      this.predicate,
      this.object,
      userid,
    ]);
  }

  async isAuthorizedToDelete(userid: string) {
    if (this.predicate === '$isATermFor') {
      const pool = new PgPoolWithLog(this.logger);

      return pool.findAny(
        'SELECT id FROM facts where subject = $1 AND predicate = $2 AND created_by = $3',
        [this.subject, '$isATermFor', userid],
      );
    }

    if (this.predicate === '$isAccountableFor' && userid === this.subject) {
      return false;
    }

    if (!(await this.isAuthorizedToSave(userid))) {
      return false;
    }

    return true;
  }

  async isAuthorizedToSave(userid: string, args?: { attributesInCreation?: string[] }) {
    if (!userid || !userid.trim()) {
      return false;
    }

    if (this.object.startsWith('us-') && userid !== this.object) {
      return false;
    }

    if (this.subject.startsWith('us-') && !['$isAccountableFor', '$isHostOf', '$isMemberOf', '$canAccess', '$canRead', '$canReferTo'].includes(this.predicate)) {
      return false;
    }

    if (this.predicate.startsWith('$') && !Fact.reservedPredicates.includes(this.predicate)) {
      return false;
    }

    if (this.predicate === '$isATermFor') {
      return true;
    }

    if (this.predicate === '$isAccountableFor') {
      return await this.isValidCreatedAtFact(userid)
        || await this.isValidAccountabilityTransfer(userid, args);
    }

    if (Object.values(rolePredicateMap).includes(this.predicate) && this.subject.trim().startsWith('us-')) {
      return this.isValidInvitation(userid, args);
    }

    const pool = new PgPoolWithLog(this.logger);

    if (this.predicate === '$isMemberOf') {
      if (await pool.findAny('SELECT id FROM facts WHERE predicate=$1 AND subject=$2', ['$isATermFor', this.subject])) {
        return false;
      }
    }

    const hasSubjectAccess = args?.attributesInCreation?.includes(this.subject)
      || await pool.findAny(SQL.getSQLToCheckAccess(userid, ['creator', 'host', 'member', 'conceptor'], this.subject));
    const hasObjectAccess = args?.attributesInCreation?.includes(this.object)
      || await this.isKnownTerm(this.object)
      || await pool.findAny(SQL.getSQLToCheckAccess(userid, ['creator', 'host', 'member', 'access', 'referer', 'selfAccess'], this.object));

    return hasSubjectAccess && hasObjectAccess;
  }

  private async isValidInvitation(userid: string, args?: { attributesInCreation?: string[] }) {
    if (args?.attributesInCreation?.includes(this.object)) {
      return true;
    }

    const pool = new PgPoolWithLog(this.logger);

    const hasObjectAccessPromise = pool.findAny(SQL.getSQLToCheckAccess(userid, ['creator', 'host'], this.object));

    const subjectIsKnownUserPromise = pool.findAny(`
      SELECT id
      FROM users
      WHERE id=$1
    `, [this.subject]);

    return await hasObjectAccessPromise && await subjectIsKnownUserPromise;
  }

  private async isValidCreatedAtFact(userid: string) {
    if (this.subject !== userid) {
      return false;
    }

    const pool = new PgPoolWithLog(this.logger);
    return !(await pool.findAny('SELECT subject FROM facts WHERE object=$1 AND predicate=$2', [this.object, this.predicate]));
  }

  private async isValidAccountabilityTransfer(userid: string, args?: {
    attributesInCreation?: string[],
  }) {
    if (this.predicate !== '$isAccountableFor') {
      return false;
    }

    if (this.subject === this.object) {
      return false;
    }

    const pool = new PgPoolWithLog(this.logger);

    if (!args?.attributesInCreation?.includes(this.object) && !(await pool.findAny('SELECT subject FROM facts WHERE subject=$1 AND predicate=$2 AND object=$3', [
      userid,
      this.predicate,
      this.object,
    ]))) {
      return false;
    }

    if (await this.isKnownTerm(this.subject)) {
      return false;
    }

    const hasSubjectAccess = args?.attributesInCreation?.includes(this.subject) || await pool.findAny(SQL.getSQLToCheckAccess(userid, ['creator', 'selfAccess', 'member', 'access'], this.subject));
    const hasObjectAccess = args?.attributesInCreation?.includes(this.object) || await pool.findAny(SQL.getSQLToCheckAccess(userid, ['creator'], this.object));

    return hasSubjectAccess && hasObjectAccess;
  }

  private async isKnownTerm(node: string) {
    const pool = new PgPoolWithLog(this.logger);

    return pool.findAny("SELECT subject FROM facts WHERE subject=$1 AND predicate='$isATermFor'", [node]);
  }
}
