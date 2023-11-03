/* eslint-disable import/no-cycle */
/* eslint-disable no-plusplus */
import { FactQuery, SubjectQueries, SubjectQuery } from '../fact_query';
import PgPoolWithLog from '../../../lib/pg-log';
import IsLogger from '../../../lib/is_logger';
import AuthorizationError from '../../attributes/errors/authorization_error';
import SQL from './authorization_sql_builder';

function andFactory() {
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
  subject: string;

  predicate: string;

  object: string;

  logger: IsLogger;

  static async initDB() {
    const pg = new PgPoolWithLog(console as unknown as IsLogger);
    const createQuery = `CREATE TABLE IF NOT EXISTS facts (subject CHAR(40), predicate CHAR(40), object TEXT);
    CREATE TABLE IF NOT EXISTS deleted_facts (subject CHAR(40), predicate CHAR(40), object TEXT, deleted_at timestamp DEFAULT NOW(), deleted_by CHAR(40));`;

    await pg.query(createQuery);

    const rawFactTableColums = await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'facts';");
    const factTableColums = rawFactTableColums.rows.map((c) => c.column_name);

    if (!factTableColums.includes('created_at')) {
      await pg.query(`
        ALTER TABLE facts ADD COLUMN created_at timestamp DEFAULT NOW();
        ALTER TABLE facts ADD COLUMN created_by CHAR(40);
        ALTER TABLE facts ADD COLUMN id SERIAL;
      `);
    }
  }

  public static async isAuthorizedToModifyPayload(
    nodeId: string, // where nodeId is in most cases a attriburteId
    userid: string,
    logger: IsLogger,
  ): Promise<boolean> {
    const pool = new PgPoolWithLog(logger);

    return pool.findAny(SQL.selectSubjectsInAnyGroup(
      userid,
      ['creator'],
      nodeId,
    ));
  }

  public static async isAuthorizedToReadPayload(
    nodeId: string, // where nodeId is in most cases a attriburteId
    userid: string,
    logger: IsLogger,
  ): Promise<boolean> {
    const pool = new PgPoolWithLog(logger);

    return pool.findAny(SQL.selectSubjectsInAnyGroup(
      userid,
      ['creator'],
      nodeId,
    ));
  }

  private static authorizedWhereClause(userid: string, factTable: string = 'facts') {
    if (!userid || !userid.match(/^us-[a-f0-9]{32}$/gi)) {
      throw new Error(`userId is invalid: "${userid}"`);
    }

    const authorizedSubjects = SQL.selectSubjectsInAnyGroup(
      userid,
      ['selfAccess', 'creator'],
    );

    const authorizedObjects = SQL.selectSubjectsInAnyGroup(
      userid,
      ['selfAccess', 'term', 'creator'],
    );

    return `(${factTable}.predicate='$isATermFor' OR (subject IN ${authorizedSubjects} AND object IN ${authorizedObjects}))`;
  }

  private static getSQLToResolvePossibleTrasitiveQuery(
    query: SubjectQuery,
    sqlPrefix: string,
    userid: string,
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

    let table = `(SELECT facts.* FROM facts
                  WHERE object = '${query[1]}'
                  AND predicate = '${query[0]}') as f`;

    if (query[0].endsWith('*')) {
      table = `(WITH RECURSIVE rfacts AS (
        SELECT facts.* FROM facts
                        WHERE object = '${query[1]}'
                        AND predicate = '${query[0]}'
        UNION ALL
          SELECT facts.* FROM facts, rfacts
                          WHERE facts.object = rfacts.subject
                          AND facts.predicate = '${query[0]}'
        )
        CYCLE subject
          SET cycl TO 'Y' DEFAULT 'N'
        USING path_array
        SELECT *
          FROM rfacts
          WHERE cycl = 'N') as f`;
    }

    const condition = [sqlPrefix, this.authorizedWhereClause(userid)]
      .filter((c) => c.trim())
      .join(' AND ');

    return `SELECT subject FROM ${table} ${condition ? `WHERE ${condition}` : ''}`;
  }

  static getSQLToResolveToSubjectIdsWithModifiers(
    subjectQueries: SubjectQueries,
    userid: string,
  ): string {
    const transitiveQueries: SubjectQuery[] = [];
    const sqlConditions: [string, string, string][] = [];
    let sqlPrefix = '';

    subjectQueries.forEach((query) => {
      if (!hasNotModifier(query) && !hasLatestModifier(query)) {
        transitiveQueries.push(query);
      } else if (hasNotModifier(query) && !hasLatestModifier(query)) {
        const object = query[1].match(/^\$not\(([a-zA-Z]+)\)$/)![1];

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
            FROM facts
            WHERE (object != '${object}' AND id IN (SELECT max(id) FROM facts WHERE predicate='${predicate}' GROUP BY subject))
            OR subject NOT IN (SELECT subject FROM facts WHERE predicate='${predicate}'))`]);
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
      .map((subjectQuery) => Fact.getSQLToResolvePossibleTrasitiveQuery(
        subjectQuery,
        sqlPrefix,
        userid,
      ))
      .join(' INTERSECT ');
  }

  static async findAll(
    { subject, predicate, object }: FactQuery,
    userid: string,
    logger: IsLogger,
  ): Promise<Fact[]> {
    ensureValidFactQuery({ subject, predicate, object });

    const pool = new PgPoolWithLog(logger);
    const and = andFactory();

    let sqlQuery = 'SELECT * FROM facts';

    sqlQuery += ` ${and()} ${Fact.authorizedWhereClause(userid)}`;

    if (subject) {
      sqlQuery += ` ${and()} subject IN (${Fact.getSQLToResolveToSubjectIdsWithModifiers(subject, userid)})`;
    }

    if (predicate) {
      sqlQuery += ` ${and()} predicate='${predicate}'`;
    }

    if (object) {
      sqlQuery += ` ${and()} object IN (${Fact.getSQLToResolveToSubjectIdsWithModifiers(object, userid)})`;
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
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this.logger = logger;
  }

  async match(factQuery: FactQuery, userid: string, logger: IsLogger): Promise<boolean> {
    let concreateObjectSpecMatch = false;
    let concreateSubjectSpecMatch = false;
    let subjectMatch;
    let objectMatch;

    if (!userid) {
      throw new Error('Fact.match needs to receive a valid userid!');
    }

    if (factQuery.predicate && !factQuery.predicate.includes(this.predicate)) {
      return false;
    }

    const concreateSubjectSpec = factQuery.subject?.filter((x) => typeof x === 'string');
    const concreateObjectSpec = factQuery.object?.filter((x) => typeof x === 'string');

    if (concreateSubjectSpec && concreateSubjectSpec.length) {
      if (concreateSubjectSpec.length > 1) {
        return false;
      }

      if (this.subject !== concreateSubjectSpec[0]) {
        return false;
      }

      concreateSubjectSpecMatch = true;
    }

    if (concreateObjectSpec && concreateObjectSpec.length) {
      if (concreateObjectSpec.length > 1) {
        return false;
      }

      if (this.object !== concreateObjectSpec[0]) {
        return false;
      }

      concreateObjectSpecMatch = true;
    }

    if (!concreateSubjectSpecMatch) {
      subjectMatch = !factQuery.subject ? [] : Fact.findAll({
        subject: [this.subject, ...factQuery.subject],
      }, userid, logger);
    }

    if (!concreateObjectSpecMatch) {
      objectMatch = !factQuery.object ? [] : Fact.findAll({
        subject: [this.object, ...factQuery.object],
      }, userid, logger);
    }

    return (!factQuery.subject || concreateSubjectSpecMatch || (await subjectMatch).length !== 0)
      && (!factQuery.object || concreateObjectSpecMatch || (await objectMatch).length !== 0);
  }

  async matchAny(factQueries: FactQuery[], userid: string): Promise<boolean> {
    const allResults = await Promise.all(
      factQueries.map((fq) => this.match(fq, userid, this.logger)),
    );

    return !!allResults.find((x) => x);
  }

  toJSON() {
    return {
      subject: this.subject,
      predicate: this.predicate,
      object: this.object,
    };
  }

  async save(userid: string) {
    if (!(await this.isAuthorizedToSave(userid))) {
      throw new AuthorizationError(userid, 'fact', this, this.logger);
    }

    const pool = new PgPoolWithLog(this.logger);

    if (this.predicate === '$isATermFor') {
      const dbRows = await pool.query('SELECT subject FROM facts WHERE subject=$1 AND predicate=$2', [this.subject, this.predicate]);

      if (!dbRows.rows.length) {
        if (!userid) {
          throw new Error('In order to save a $isATermFor fact a userid has to be provided as a parameter of the fact.save method.');
        }

        await pool.query('INSERT INTO facts (subject, predicate, object, created_by) VALUES ($1, $2, $3, $5), ($1, $4, $5, NULL)', [
          this.subject,
          this.predicate,
          this.object,
          '$wasCreatedBy',
          userid,
        ]);
      }
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
    if (this.predicate === '$isATermFor' || !(await this.isAuthorizedToSave(userid))) {
      throw new AuthorizationError(userid, 'fact', this, this.logger);
    }

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

  async isAuthorizedToSave(userid) {
    if (!userid || !userid.trim()) {
      return false;
    }

    if (this.predicate === '$isATermFor') {
      return true;
    }

    if (await this.isValidCreatedAtFact(userid)) {
      return true;
    }

    const pool = new PgPoolWithLog(this.logger);

    return pool.findAny(`
      SELECT *
      FROM facts
      WHERE subject IN ${SQL.selectSubjectsInAnyGroup(userid, ['creator'], this.subject)}
      AND object IN ${SQL.selectSubjectsInAnyGroup(userid, ['creator', 'term', 'selfAccess'], this.subject)}
    `);
  }

  async isValidCreatedAtFact(userid: string) {
    if (this.predicate === '$wasCreatedBy') {
      if (this.object !== userid) {
        return false;
      }

      const pool = new PgPoolWithLog(this.logger);
      return !(await pool.findAny('SELECT subject FROM facts WHERE subject=$1 AND predicate=$2', [this.subject, this.predicate]));
    }

    return false;
  }
}
