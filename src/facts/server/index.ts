/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-cycle */
/* eslint-disable no-plusplus */
import md5 from 'md5';
import assert from 'assert';
import { FactQuery, SubjectQueries, SubjectQuery } from '../fact_query';
import PgPoolWithLog from '../../../lib/pg-log';
import IsLogger from '../../../lib/is_logger';
import AuthorizationError from '../../attributes/errors/authorization_error';
import SQL, { rolePredicateMap } from './authorization_sql_builder';
import cache from '../../server/cache';
import EnsureIsValid from '../../../lib/utils/sql_values';

type FactBox = {
  id: number;
  graphId: number | null;
};

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

  if (isSubjectEmpty && isObjectEmpty && isPredicateEmpty) {
    throw new Error('invalid FactQuery, provide at least one of the following conditions: subject, predicate, object');
  }

  if (predicate && !Array.isArray(predicate)) {
    throw new Error('invalid FactQuery, predicate must be an array of strings!');
  }

  if (predicate?.find((p) => !EnsureIsValid.predicate(p))) {
    throw new Error(`invalid predicate in query: ${predicate}`);
  }

  [...(subject || []), ...(object || [])].forEach((sq) => {
    if (typeof sq === 'string') {
      if (!EnsureIsValid.nodeId(sq)) {
        throw new Error(`invalid Id in subject query: ${sq}`);
      }
    } else if (Array.isArray(sq)) {
      if (sq.length === 3 && !EnsureIsValid.subject(sq[0])) {
        throw new Error(`invalid subject part in fact query detected: ${sq[0]}`);
      }

      if (sq.length === 2 && !EnsureIsValid.predicate(sq[0])) {
        throw new Error(`invalid predicate part in fact query detected: ${sq[0]}`);
      }

      if (!EnsureIsValid.subject(sq[1])) {
        throw new Error(`invalid subject part in fact query detected: ${sq[1]}`);
      }

      if (sq[2] && sq[2] !== '$it') {
        throw new Error(`invalid object part in fact query detected: ${sq[2]}`);
      }

      if (sq.length > 3) {
        throw new Error('invalid array length in query detected');
      }
    } else {
      throw new Error(`subject query needs to be array or string: ${sq}`);
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
      ALTER TABLE kv_attributes ADD COLUMN IF NOT EXISTS size int DEFAULT NULL;
      ALTER TABLE bl_attributes ADD COLUMN IF NOT EXISTS size int DEFAULT NULL;
      CREATE INDEX IF NOT EXISTS idx_facts_subject ON facts (subject);
      CREATE INDEX IF NOT EXISTS idx_facts_predicate ON facts (predicate);
      CREATE INDEX IF NOT EXISTS idx_facts_object ON facts (object);
      CREATE INDEX IF NOT EXISTS idx_kv_attr_id ON kv_attributes (id);
      CREATE INDEX IF NOT EXISTS idx_facts_composite ON facts(subject, predicate, object);
      ALTER TABLE facts ALTER COLUMN subject SET NOT NULL;
      ALTER TABLE facts ALTER COLUMN predicate SET NOT NULL;
      ALTER TABLE facts ALTER COLUMN object SET NOT NULL;
      CREATE SEQUENCE IF NOT EXISTS graph_id START WITH 1000;
      ALTER TABLE facts ADD COLUMN IF NOT EXISTS fact_box_id int DEFAULT 0;
      ALTER TABLE facts ADD COLUMN IF NOT EXISTS graph_id int;
      CREATE INDEX IF NOT EXISTS idx_facts_fact_box_id ON facts (fact_box_id);
      CREATE INDEX IF NOT EXISTS idx_facts_fact_graph_id ON facts (graph_id);

      CREATE TABLE IF NOT EXISTS users_fact_boxes (fact_box_id int, user_id int);
      CREATE INDEX IF NOT EXISTS idx_users_fact_boxes_fact_box_id ON users_fact_boxes (fact_box_id);
      CREATE INDEX IF NOT EXISTS idx_users_fact_boxes_user_id ON users_fact_boxes (user_id);
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_unique;
      ALTER TABLE users ADD CONSTRAINT users_id_unique UNIQUE (id);

      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
      ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (hashed_email);

      CREATE TABLE IF NOT EXISTS quota_events (id SERIAL, node_id CHAR(40), total_storage_available int, created_at timestamp DEFAULT NOW(), payment_provider CHAR(40), payment_provider_payload TEXT);
      ALTER TABLE quota_events ALTER COLUMN total_storage_available TYPE BIGINT;
      ALTER TABLE quota_events ADD COLUMN IF NOT EXISTS provider_id CHAR(40);
      ALTER TABLE quota_events ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP with time zone;
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

  public static async isAuthorizedToManageQuota(
    nodeId: string,
    userid: string,
    logger: IsLogger,
  ): Promise<boolean> {
    assert(nodeId, 'nodeId needs to be provided in isAuthorizedToManageQuota');
    assert(userid, 'userid needs to be provided in isAuthorizedToManageQuota');

    if (nodeId === userid) {
      return true;
    }

    const pool = new PgPoolWithLog(logger);

    return pool.findAny(SQL.getSQLToCheckAccess(
      userid,
      ['creator'],
      nodeId,
      logger,
    ));
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
      logger,
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
      logger,
    ));

    return res;
  }

  private static async withAuthNodesAndFacts(userid: string, logger: IsLogger) {
    EnsureIsValid.userId(userid);

    const authorizedNodes = await SQL.selectSubjectsInAnyGroup(
      userid,
      ['selfAccess', 'creator', 'host', 'member', 'access', 'reader'],
      undefined,
      logger,
    );

    const [allTerms, factScope] = await Promise.all([
      Fact.getAllTerms(logger),
      Fact.getFactScopeByUser(userid, logger),
    ]);

    return `
    WITH  auth_nodes AS (${authorizedNodes}),
          auth_facts AS (
              SELECT id, subject, predicate, object
              FROM facts
              WHERE predicate='$isATermFor'
              AND fact_box_id=0
            UNION
              SELECT id, subject, predicate, object
              FROM facts
              WHERE facts.fact_box_id IN (${factScope.factBoxIds.map(EnsureIsValid.factBoxId).join(',')})
              AND subject IN (SELECT node FROM auth_nodes)
              AND (object IN (SELECT node FROM auth_nodes) OR object = ANY ('{${allTerms.map(EnsureIsValid.term).join(',')}}'))
          )
    `;
  }

  private static async authorizedSelect(userid: string, logger: IsLogger) {
    return `
    ${await this.withAuthNodesAndFacts(userid, logger)}
    SELECT subject, predicate, object FROM auth_facts`;
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
      return `SELECT subject FROM auth_facts WHERE predicate='${EnsureIsValid.predicate(query[0])}' ${sqlPrefix ? `AND ${sqlPrefix}` : ''}`;
    }

    if (query[1] === '$anything') {
      throw new Error(`$anything selector is only allowed in context of the following predicates: ${predicatedAllowedToQueryAnyObjects.join(', ')}`);
    }

    let table = `(SELECT auth_facts.subject, auth_facts.predicate, auth_facts.object FROM auth_facts
                  WHERE object = '${EnsureIsValid.object(query[1])}'
                  AND predicate = '${EnsureIsValid.predicate(query[0])}') as f`;

    if (query[0].endsWith('*')) {
      table = `(WITH RECURSIVE rfacts AS (
        SELECT auth_facts.subject, auth_facts.predicate, auth_facts.object FROM auth_facts
                        WHERE object = '${EnsureIsValid.object(query[1])}'
                        AND predicate = '${EnsureIsValid.predicate(query[0])}'
        UNION ALL
          SELECT auth_facts.subject, auth_facts.predicate, auth_facts.object FROM auth_facts, rfacts
                          WHERE auth_facts.object = rfacts.subject
                          AND auth_facts.predicate = '${EnsureIsValid.predicate(query[0])}'
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
          sqlConditions.push(['subject', 'NOT IN', `(SELECT subject FROM auth_facts WHERE predicate='${EnsureIsValid.predicate(query[0])}' AND object='${EnsureIsValid.object(object)}')`]);
        }
      } else if (!hasNotModifier(query) && hasLatestModifier(query)) {
        const predicate = query[0].match(/^\$latest\(([a-zA-Z]+)\)$/)![1];
        if (predicate) {
          sqlConditions.push(['subject', 'IN', `(SELECT subject FROM auth_facts WHERE id IN (SELECT max(id) FROM auth_facts WHERE predicate='${EnsureIsValid.predicate(predicate)}' GROUP BY subject) AND object='${EnsureIsValid.object(query[1])}')`]);
        }
      } else if (hasNotModifier(query) && hasLatestModifier(query)) {
        const predicate = query[0].match(/^\$latest\(([a-zA-Z]+)\)$/)![1];
        const object = query[1].match(/^\$not\(([a-zA-Z0-9-]+)\)$/)![1];

        if (predicate && object) {
          sqlConditions.push(['subject', 'IN', `(SELECT
            subject
            FROM auth_facts
            WHERE (object != '${EnsureIsValid.object(object)}' AND id IN (SELECT max(id) FROM auth_facts WHERE predicate='${EnsureIsValid.predicate(predicate)}' GROUP BY subject))
            OR subject NOT IN (SELECT subject FROM auth_facts WHERE predicate='${EnsureIsValid.predicate(predicate)}'))`]);
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

  static async saveAllWithoutAuthCheck(
    facts: Fact[],
    userid: string,
    isNewUserScopedGraph: boolean | undefined,
    logger: IsLogger,
  ): Promise<FactBox | undefined> {
    if (facts.length === 0) return undefined;

    const specialFacts = facts.filter((fact) => fact.hasSpecialCreationLogic());
    const nonSpecialFacts = facts.filter((fact) => !fact.hasSpecialCreationLogic());
    let factPlacement: FactBox | undefined;

    if (isNewUserScopedGraph) {
      factPlacement = {
        id: await Fact.getInternalUserId(userid, logger),
        graphId: await Fact.getNewGraphId(logger),
      };
    }

    for (let i = 0; i < specialFacts.length; i += 1) {
      // we need to create this one by one to make sure no
      // duplicates gets inserted and other checks pass.
      // eslint-disable-next-line no-await-in-loop
      await specialFacts[i]?.save(userid);
    }

    await this.saveAllWithoutAuthCheckAndSpecialTreatment(
      nonSpecialFacts,
      userid,
      factPlacement,
      logger,
    );

    if (isNewUserScopedGraph) {
      return factPlacement;
    }

    return undefined;
  }

  static async saveAllWithoutAuthCheckAndSpecialTreatment(
    facts: Fact[],
    userid: string,
    factBox: FactBox | undefined,
    logger: IsLogger,
  ) {
    if (facts.length === 0) return;

    const pool = new PgPoolWithLog(logger);

    if (factBox) {
      const values = facts
        .map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`)
        .join(', ');

      const flatParams = facts.flatMap((fact) => [
        fact.subject,
        fact.predicate,
        fact.object,
        userid,
        factBox.id,
        factBox.graphId,
      ]);

      if (values.length) {
        await pool.query(
          `INSERT INTO facts (subject, predicate, object, created_by, fact_box_id, graph_id) VALUES ${values}`,
          flatParams,
        );
      }
    } else {
      const promises: Promise<any>[] = [];

      for (let index = 0; index < facts.length; index++) {
        const fact = facts[index];

        if (fact) {
          const factPlacement = await fact.getFactBoxPlacement(userid);
          const insertPromise = pool.query(
            'INSERT INTO facts (subject, predicate, object, created_by, fact_box_id, graph_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [
              fact.subject,
              fact.predicate,
              fact.object,
              userid,
              factPlacement.id,
              factPlacement.graphId,
            ],
          );

          if (factBox) {
            promises.push(insertPromise);
          } else {
            await insertPromise;
          }
        }
      }

      await Promise.all(promises);
    }
  }

  static async findNodes(
    isSubjectAllOf: SubjectQueries,
    isObjectAllOf: SubjectQueries,
    blacklistNodes: [string, string][],
    userid: string,
    logger: IsLogger,
  ) {
    const pool = new PgPoolWithLog(logger);
    const baseQuery = await Fact.withAuthNodesAndFacts(userid, logger);
    const blacklist = blacklistNodes.map(([s, p]) => (`SELECT object FROM auth_facts where subject='${EnsureIsValid.subject(s)}' AND predicate='${EnsureIsValid.predicate(p)}'`)).join(' UNION ').trim();
    const subjectSet = Fact.getSQLToResolveToSubjectIdsWithModifiers(isSubjectAllOf);
    const objectSet = isObjectAllOf.map((q) => `SELECT object FROM auth_facts WHERE subject='${EnsureIsValid.subject(q[0])}' AND predicate='${EnsureIsValid.predicate(q[1])}'`).join(' INTERSECT ').trim();

    const candidateSelects: string[] = [];

    if (subjectSet) {
      candidateSelects.push(subjectSet);
    }

    if (objectSet) {
      candidateSelects.push(objectSet);
    }

    if (!candidateSelects.length) {
      candidateSelects.push('SELECT DISTINCT node FROM auth_nodes');
    }

    const result = await pool.query(`
      ${baseQuery}
      SELECT DISTINCT node
      FROM (${candidateSelects.join(' INTERSECT ')}) as t(node)
      ${blacklist ? `WHERE node NOT IN (${blacklist})` : ''}
    `);

    return result.rows.map((row) => row.node.trim());
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

    let sqlQuery = await Fact.authorizedSelect(userid, logger);

    if (subject) {
      const subjectFilter = Fact.getSQLToResolveToSubjectIdsWithModifiers(subject);
      const singleValueMatch = subjectFilter.match(/^SELECT '(.*?)'$/);

      if (singleValueMatch && singleValueMatch[1]) {
        sqlQuery += ` ${and()} subject='${EnsureIsValid.subject(singleValueMatch[1])}'`;
      } else {
        sqlQuery += ` ${and()} subject IN (${subjectFilter})`;
      }
    }

    if (predicate) {
      if (predicate.length === 1 && predicate[0]) {
        sqlQuery += ` ${and()} predicate='${EnsureIsValid.predicate(predicate[0])}'`;
      } else {
        sqlQuery += ` ${and()} predicate IN (${predicate.map(EnsureIsValid.predicate).map((p) => `'${p}'`).join(',')})`;
      }
    }

    if (object) {
      sqlQuery += ` ${and()} object IN (${Fact.getSQLToResolveToSubjectIdsWithModifiers(object)})`;
    }

    if (subjectBlacklist && subjectBlacklist.length) {
      const bl = subjectBlacklist
        .map(([s, p]) => (`SELECT object FROM facts where subject='${EnsureIsValid.subject(s)}' AND predicate='${EnsureIsValid.predicate(p)}'`))
        .join(' UNION ');
      sqlQuery += ` ${and()} subject NOT IN (${bl})`;
    }

    if (objectBlacklist && objectBlacklist.length) {
      const bl = objectBlacklist
        .map(([s, p]) => (`SELECT object FROM facts where subject='${EnsureIsValid.subject(s)}' AND predicate='${EnsureIsValid.predicate(p)}'`))
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

  async save(userid: string): Promise<void> {
    this.ensureValidSyntax();

    if (!(await this.isAuthorizedToSave(userid))) {
      throw new AuthorizationError(userid, 'fact', this, this.logger);
    }

    const pool = new PgPoolWithLog(this.logger);

    if (this.predicate === '$isATermFor') {
      const dbRows = await pool.query('SELECT subject FROM facts WHERE subject=$1 OR object=$1 OR subject=$2', [this.subject, this.object]);
      cache.invalidate('terms');

      if (!dbRows.rows.length) {
        if (!userid) {
          throw new Error('In order to save a $isATermFor fact a userid has to be provided as a parameter of the fact.save method.');
        }

        await pool.query('INSERT INTO facts (subject, predicate, object, created_by, fact_box_id, graph_id) VALUES ($1, $2, $3, $5, 0, NULL), ($5, $4, $1, NULL, 0, NULL)', [
          this.subject,
          this.predicate,
          this.object,
          '$isAccountableFor',
          userid,
        ]);
      }

      return;
    }

    const factPlacement = await this.getFactBoxPlacement(userid);

    if (!factPlacement.id) {
      throw new Error('Error creating fact box id: fact placement does not have a id');
    }

    if (this.predicate === '$isAccountableFor') {
      const dbRows = await pool.query('SELECT subject, predicate, object FROM facts WHERE object=$1 AND predicate=$2', [this.object, this.predicate]);

      if (dbRows.rows.length) {
        for (let index = 0; index < dbRows.rows.length; index++) {
          const r = dbRows.rows[index];
          const oldFact = new Fact(r.subject, r.predicate, r.object, this.logger);
          // eslint-disable-next-line no-await-in-loop
          await oldFact.deleteWithoutAuthCheck(userid);
        }
      }

      await pool.query('INSERT INTO facts (subject, predicate, object, created_by, fact_box_id, graph_id) VALUES ($1, $2, $3, $4, $5, $6)', [
        this.subject,
        this.predicate,
        this.object,
        userid,
        factPlacement.id,
        factPlacement.graphId,
      ]);
    } else {
      await pool.query('INSERT INTO facts (subject, predicate, object, created_by, fact_box_id, graph_id) VALUES ($1, $2, $3, $4, $5, $6)', [
        this.subject,
        this.predicate,
        this.object,
        userid,
        factPlacement.id,
        factPlacement.graphId,
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

    if (this.predicate === '$isATermFor') {
      cache.invalidate('terms');
      cache.invalidate(`isKnownTerm/${this.subject.trim()}`);
    }

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

    if (this.subject.startsWith('us-') && !['$isAccountableFor', '$isHostOf', '$isMemberOf', '$canAccess', '$canRead', '$canRefine', '$canReferTo'].includes(this.predicate)) {
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
      || await pool.findAny(SQL.getSQLToCheckAccess(userid, ['creator', 'host', 'member', 'conceptor'], this.subject, this.logger));
    const hasObjectAccess = args?.attributesInCreation?.includes(this.object)
      || await Fact.isKnownTerm(this.object, this.logger)
      || await pool.findAny(SQL.getSQLToCheckAccess(userid, ['creator', 'host', 'member', 'access', 'referer', 'selfAccess'], this.object, this.logger));

    return hasSubjectAccess && hasObjectAccess;
  }

  static async getFactScopeByUser(
    userId: string,
    logger: IsLogger,
  ): Promise<{ internalUserId: number, factBoxIds: number[] }> {
    const pool = new PgPoolWithLog(logger);
    const internalUserId = await Fact.getInternalUserId(userId, logger);

    // const hit = cache.get(`factScopeByUser/${internalUserId}`);

    // if (hit) {
    //   return hit;
    // }

    const factBoxIdsResult = await pool.query('SELECT fact_box_id FROM users_fact_boxes WHERE user_id=$1', [internalUserId]);
    const factBoxIds = factBoxIdsResult.rows.map((r) => r.fact_box_id);

    const result = {
      internalUserId,
      factBoxIds: [
        0, internalUserId, ...factBoxIds,
      ],
    };

    // cache.set(`factScopeByUser/${internalUserId}`, result);

    return result;
  }

  static async isNewUserScopedGraph(
    facts: Fact[],
    newAttributeIds: string[],
    userId: string,
    logger: IsLogger,
  ): Promise<boolean> {
    const allTerms = await Fact.getAllTerms(logger);

    const connectingFact = facts.find((fact) => {
      const sub = fact.subject;
      const obj = fact.object;

      if (newAttributeIds.includes(sub) && newAttributeIds.includes(obj)) {
        // subject and object are attribute ids which did not exists before.
        // So, we can say this fact does not connect the new graph to an existing graph.
        return false;
      }

      if (newAttributeIds.includes(sub) && allTerms.includes(obj)) {
        // the fact is classifying a new attribute, this does not count as connecting two graphs
        return false;
      }

      if (newAttributeIds.includes(sub) && obj === userId) {
        // The subject is a new attribute and the object is the users who created it
        // -> Does not count as connecting the graph to an existing graph
        return false;
      }

      return true;
    });

    return !connectingFact;
  }

  static async moveAllAccountabilityFactsToFactBox(
    attributeIds: string[],
    factBox: FactBox,
    logger: IsLogger,
  ) {
    const pool = new PgPoolWithLog(logger);
    const attributeString = attributeIds.map((id) => `'${EnsureIsValid.nodeId(id)}'`).join(',');

    await pool.query(`UPDATE facts SET fact_box_id=$1, graph_id=$2 WHERE predicate='$isAccountableFor' AND object IN (${attributeString})`, [
      factBox.id,
      factBox.graphId,
    ]);
  }

  static areKnownSubjects(nodeIds: string[], logger: IsLogger): Promise<boolean> {
    const pool = new PgPoolWithLog(logger);
    const idCheckCondition = nodeIds.map((a, i) => `subject=$${i + 1}`).join(' OR ');

    return pool.findAny(`SELECT id FROM facts WHERE ${idCheckCondition}`, nodeIds);
  }

  private async isValidInvitation(userid: string, args?: { attributesInCreation?: string[] }) {
    if (args?.attributesInCreation?.includes(this.object)) {
      return true;
    }

    const pool = new PgPoolWithLog(this.logger);

    const hasObjectAccessPromise = pool.findAny(SQL.getSQLToCheckAccess(userid, ['creator', 'host'], this.object, this.logger));

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

    if (await Fact.isKnownTerm(this.subject, this.logger)) {
      return false;
    }

    const hasSubjectAccess = args?.attributesInCreation?.includes(this.subject) || await pool.findAny(SQL.getSQLToCheckAccess(userid, ['creator', 'selfAccess', 'member', 'access', 'conceptor'], this.subject, this.logger));
    const hasObjectAccess = args?.attributesInCreation?.includes(this.object) || await pool.findAny(SQL.getSQLToCheckAccess(userid, ['creator'], this.object, this.logger));

    return hasSubjectAccess && hasObjectAccess;
  }

  private static async isKnownTerm(node: string, logger: IsLogger) {
    const hit = cache.get(`isKnownTerm/${node.trim()}`);

    if (hit) {
      return hit;
    }

    const pool = new PgPoolWithLog(logger);

    const result = pool.findAny("SELECT subject FROM facts WHERE subject=$1 AND predicate='$isATermFor'", [node]);

    if (result) {
      cache.set(`isKnownTerm/${node}`, result);
    }

    return result;
  }

  private static async getAllTerms(logger) {
    const hit = cache.get('terms');

    if (hit) {
      return hit;
    }

    const pool = new PgPoolWithLog(logger);

    const rawResult = await pool.query("SELECT subject FROM facts WHERE predicate='$isATermFor'");
    const result = rawResult.rows.map((r) => r.subject.trim());

    if (result) {
      cache.set('terms', result);
    }

    return result;
  }

  private async getFactBoxPlacement(userId: string): Promise<FactBox> {
    const internalUserId = await Fact.getInternalUserId(userId, this.logger);

    if (this.subject.startsWith('us-')) {
      // We end up here when e.g. when
      // us-82054609511ad4ead53fceedf9c2f6bb $isHostOf kv-01943bcc-5db6-7386-9d63-246e0d0f3185
      const objectFactPlacement = await Fact.getFactPlacementOf(this.object, userId, this.logger);
      const internalSubId = await Fact.getInternalUserId(this.subject, this.logger);

      if (!objectFactPlacement.graphId) {
        await Fact.ensureUserIsAssignedToFactBox(internalSubId, objectFactPlacement, this.logger);
        return objectFactPlacement;
      }

      if (objectFactPlacement.id === internalSubId) {
        return objectFactPlacement;
      }

      const newFactBox = await Fact.moveUserGraphToNewFactBox(
        objectFactPlacement,
        this.logger,
        [internalUserId, internalSubId],
      );

      return newFactBox;
    }

    if (this.object.startsWith('us-')) {
      if (userId !== this.object) {
        throw new Error('User can only use its own id as object');
      }

      const subjectFactPlacement = await Fact.getFactPlacementOf(this.subject, userId, this.logger);

      if (!subjectFactPlacement.graphId) {
        await Fact.ensureUserIsAssignedToFactBox(internalUserId, subjectFactPlacement, this.logger);
        return subjectFactPlacement;
      }

      return subjectFactPlacement;
    }

    const [factBoxSubject, factBoxObject] = await Promise.all([
      Fact.getFactPlacementOf(this.subject, userId, this.logger),
      Fact.getFactPlacementOf(this.object, userId, this.logger),
    ]);

    // The object is a term so the fact goes into the fact box of the subject
    if (factBoxObject.id === 0) {
      return factBoxSubject;
    }

    // the subject is a term, so it goes into the term box
    if (factBoxSubject.id === 0) {
      return { id: 0, graphId: null };
    }

    // a) both nodes are from the user space
    //    -> getFactPlacementOf will make sure that it is the same user
    if (factBoxSubject.graphId && factBoxObject.graphId) {
      // Both nodes belong to the same graph of the same user
      if (factBoxSubject.id === internalUserId
        && factBoxObject.id === internalUserId
        && factBoxSubject.graphId === factBoxObject.graphId) {
        return factBoxObject;
      }

      // The nodes belong to the same user but different graphs
      if (factBoxSubject.id === internalUserId && factBoxObject.id === internalUserId) {
        return {
          id: internalUserId,
          graphId: await Fact.getNewGraphId(this.logger),
        };
      }

      throw new Error('Unexpected error while trying to determine fact box id');
    }

    // b) None of the nodes is from a private graph
    if (!factBoxSubject.graphId && !factBoxObject.graphId) {
      return {
        id: await Fact.mergeFactBoxes(factBoxSubject.id, factBoxObject.id, this.logger),
        graphId: null,
      };
    }

    // c) subject is a private graph and object is a fact box
    if (!factBoxSubject.graphId && factBoxObject.graphId) {
      return {
        id: await Fact.mergeUserGraphToFactBox(factBoxObject, factBoxSubject, this.logger),
        graphId: null,
      };
    }

    // d) subject is a fact box and object is a graph box
    if (factBoxSubject.graphId && !factBoxObject.graphId) {
      return {
        id: await Fact.mergeUserGraphToFactBox(factBoxSubject, factBoxObject, this.logger),
        graphId: null,
      };
    }

    throw new Error('Unexpected error while trying to determine fact box id');
  }

  private static async getFactPlacementOf(
    nodeId: string,
    userId: string,
    logger: IsLogger,
  ): Promise<FactBox> {
    const pool = new PgPoolWithLog(logger);

    if (nodeId.startsWith('us-')) {
      if (nodeId !== userId) {
        throw new Error('Not allowed to access fact box of another user');
      }

      return {
        id: await Fact.getInternalUserId(nodeId, logger),
        graphId: null, // Maybe we need another value here: like 0, or -1
      };
    }

    if (await Fact.isKnownTerm(nodeId, logger)) {
      return {
        id: 0,
        graphId: null,
      };
    }

    const result = await pool.query('SELECT fact_box_id, graph_id FROM facts WHERE subject=$1 OR object=$1 LIMIT 1', [nodeId]);

    if (!result.rows[0]) {
      return {
        id: await Fact.getInternalUserId(userId, logger),
        graphId: await Fact.getNewGraphId(logger),
      };
    }

    return {
      id: result.rows[0].fact_box_id,
      graphId: result.rows[0].graph_id,
    };
  }

  private static async moveUserGraphToNewFactBox(
    graphBox: FactBox,
    logger: IsLogger,
    users: number[],
  ): Promise<FactBox> {
    const pool = new PgPoolWithLog(logger);
    const factBoxId = await Fact.getNewFactBoxId(logger);

    if (!graphBox.id || !graphBox.graphId) {
      throw new Error('Cannot migration graph to new fact box as graphBox does not has an id');
    }

    await Promise.all([
      pool.query('UPDATE facts SET fact_box_id=$1, graph_id=NULL WHERE fact_box_id=$2', [factBoxId, graphBox.id]),
      ...users.map((userId) => pool.query('INSERT INTO users_fact_boxes (fact_box_id, user_id) VALUES ($1, $2);', [factBoxId, userId])),
    ]);

    users.map((userId) => cache.invalidate(`factScopeByUser/${userId}`));

    return {
      id: factBoxId,
      graphId: null,
    };
  }

  private static async mergeUserGraphToFactBox(
    graphBox: FactBox,
    factBox: FactBox,
    logger: IsLogger,
  ): Promise<number> {
    const pool = new PgPoolWithLog(logger);

    if (!graphBox.graphId && !graphBox.id) {
      logger.warn(`Cannot merge a user graph without a fact box. Graph box is invalid: ${JSON.stringify(graphBox)}`);
      throw new Error('Cannot merge a user graph without a fact box. Graph box is invalid');
    }

    if (factBox.graphId || !factBox.id) {
      logger.warn(`Cannot merge a user graph without a fact box. Fact box is invalid: ${JSON.stringify(factBox)}`);
      throw new Error('Cannot merge a user graph without a fact box. Fact box is invalid');
    }

    if (!graphBox.graphId || !factBox.id || !graphBox.id) {
      logger.warn(`Unexpected error when merging user graph to fact box, fact box is missing a value: FactBox: ${JSON.stringify(factBox)}, GraphBox: ${JSON.stringify(graphBox)}`);
      throw new Error('Unexpected error when merging user graph to fact box, fact box is missing a value');
    }

    cache.invalidate(`factScopeByUser/${graphBox.id}`);

    await Promise.all([
      pool.query('UPDATE facts SET fact_box_id=$1, graph_id=NULL WHERE fact_box_id=$2 AND graph_id=$3', [factBox.id, graphBox.id, graphBox.graphId]),
      pool.query('UPDATE users_fact_boxes SET fact_box_id=$1 WHERE fact_box_id=$2', [factBox.id, graphBox.id]),
      Fact.ensureUserIsAssignedToFactBox(graphBox.id, factBox, logger),
    ]);

    return factBox.id;
  }

  // TODO: make sure the smaller fact box is merged into the bigger fact box;
  private static async mergeFactBoxes(
    node1Id: number | undefined,
    node2Id: number | undefined,
    logger: IsLogger,
  ): Promise<number> {
    if (!node1Id && node2Id) {
      return node2Id;
    }

    if (!node2Id && node1Id) {
      return node1Id;
    }

    if (!node1Id && !node1Id) {
      throw new Error('Cannot merge fact boxes without ids');
    }

    if (node1Id === 0) {
      // eslint-disable-next-line no-param-reassign
      node1Id = node2Id;
      // eslint-disable-next-line no-param-reassign
      node2Id = 0;
    }

    const pool = new PgPoolWithLog(logger);

    const usersOfOldFactBox = await pool.query('SELECT user_id FROM users_fact_boxes WHERE fact_box_id=$1', [node1Id]);

    usersOfOldFactBox.rows.forEach((row) => {
      cache.invalidate(`factScopeByUser/${row.user_id}`);
    });

    await Promise.all([
      pool.query('UPDATE facts SET fact_box_id=$1 WHERE fact_box_id=$2', [node2Id, node1Id]),
      pool.query('UPDATE users_fact_boxes SET fact_box_id=$1 WHERE fact_box_id=$2', [node2Id, node1Id]),
    ]);

    if (!node2Id) {
      throw new Error('Unexpected error while merging fact boxes');
    }

    return node2Id;
  }

  private static async getInternalUserId(userid: string, logger: IsLogger): Promise<number> {
    const hit = cache.get(`internalUserId/${userid}`);

    if (hit) {
      return hit;
    }

    const pool = new PgPoolWithLog(logger);
    const result = await pool.query('SELECT _id as internal_user_id FROM users WHERE id=$1', [userid]);

    if (!result.rows[0]) {
      throw new Error(`User with id ${userid} does not exist`);
    }

    if (result) {
      cache.set(`internalUserId/${userid}`, result.rows[0].internal_user_id);
    }

    return result.rows[0].internal_user_id;
  }

  public static async getNewFactBoxId(logger: IsLogger) {
    const pool = new PgPoolWithLog(logger);
    const newFactBoxIdResult = await pool.query("SELECT nextval('users__id_seq') as id");

    return newFactBoxIdResult.rows[0].id;
  }

  public static async getNewGraphId(logger: IsLogger) {
    const pool = new PgPoolWithLog(logger);
    const newFactBoxIdResult = await pool.query("SELECT nextval('graph_id') as id");

    return newFactBoxIdResult.rows[0].id;
  }

  private static async ensureUserIsAssignedToFactBox(
    internalUserId: number,
    factBox: FactBox,
    logger: IsLogger,
  ) {
    const pool = new PgPoolWithLog(logger);

    if (await pool.findAny('SELECT * FROM users_fact_boxes WHERE fact_box_id=$1 AND fact_box_id=$2', [factBox.id, internalUserId])) {
      return;
    }

    cache.invalidate(`factScopeByUser/${internalUserId}`);

    await pool.query('INSERT INTO users_fact_boxes (fact_box_id, user_id) VALUES ($1, $2)', [factBox.id, internalUserId]);
  }
}
