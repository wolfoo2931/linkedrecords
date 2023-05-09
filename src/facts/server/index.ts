/* eslint-disable no-plusplus */
import intersect from 'intersect';
import { FactQuery, SubjectQueries, SubjectQuery } from '../fact_query';
import PgPoolWithLog from '../../../lib/pg-log';
import IsLogger from '../../../lib/is_logger';

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

export default class Fact {
  subject: string;

  predicate: string;

  object: string;

  logger?: IsLogger;

  static async initDB() {
    const pg = new PgPoolWithLog();
    const createQuery = 'CREATE TABLE IF NOT EXISTS facts (subject CHAR(40), predicate CHAR(40), object TEXT);';
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

  private static async resolveToSubjectIds(
    query: SubjectQuery,
    sqlPrefix: string,
    logger?: IsLogger,
  ): Promise<string[]> {
    const pool = new PgPoolWithLog(logger);
    const predicatedAllowedToQueryAnyObjects = ['$isATermFor'];

    if (typeof query === 'string') {
      return [query];
    }

    if (!query || !query.length || query.length !== 2) {
      throw new Error('resolveToSubjectIds must be string or array with two elements');
    }

    if (query[1] === '$anything' && query[0] && predicatedAllowedToQueryAnyObjects.includes(query[0])) {
      const conditionSuffix = sqlPrefix ? `AND ${sqlPrefix}` : '';
      const dbRows = await pool.query(`SELECT subject FROM facts WHERE predicate=$1 ${conditionSuffix}`, [query[0]]);
      return dbRows.rows.map((row) => row.subject.trim());
    }

    if (query[1] === '$anything') {
      throw new Error(`$anything selector is only allowed in context of the following predicates: ${predicatedAllowedToQueryAnyObjects.join(', ')}`);
    }

    const table = `(WITH RECURSIVE rfacts AS (
      SELECT facts.* FROM facts
                      WHERE object = $2
                      AND predicate = $1
    UNION ALL
      SELECT facts.* FROM facts, rfacts
                      WHERE facts.object = rfacts.subject
                      AND facts.predicate = $1
    )
    CYCLE subject
      SET cycl TO 'Y' DEFAULT 'N'
    USING path_array
    SELECT *
      FROM rfacts
      WHERE cycl = 'N') as f`;

    const conditionSuffix = sqlPrefix ? `WHERE ${sqlPrefix}` : '';

    console.log(`SELECT subject FROM ${table} ${conditionSuffix}`);

    const dbRows = await pool.query(`SELECT subject FROM ${table} ${conditionSuffix}`, [query[0], query[1]]);
    return dbRows.rows.map((row) => row.subject.trim());
  }

  static async resolveToSubjectIdsWithModifiers(
    subjectQueries?: SubjectQueries,
    logger?: IsLogger,
  ) {
    if (!subjectQueries) {
      return [];
    }

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

    const subjectIdsPromise = transitiveQueries
      .map((subjectQuery) => Fact.resolveToSubjectIds(subjectQuery, sqlPrefix, logger));

    const result = intersect(await Promise.all(subjectIdsPromise));

    return result;
  }

  static async findAll(
    { subject, predicate, object }: FactQuery,
    logger?: IsLogger,
  ): Promise<Fact[]> {
    const pool = new PgPoolWithLog(logger);
    const queryAsSQL: string[] = [];
    const queryParams: string[] = [];
    const query: { [key: string]: string[] } = {};

    if (subject) {
      query['subject'] = await Fact.resolveToSubjectIdsWithModifiers(subject);
    }

    if (predicate) {
      query['predicate'] = predicate;
    }

    if (object) {
      query['object'] = await Fact.resolveToSubjectIdsWithModifiers(object);
    }

    if (query['subject'] && query['subject'].length === 0) {
      return [];
    }

    if (query['object'] && query['object'].length === 0) {
      return [];
    }

    Object.entries(query)
      .filter((queryEntry) => queryEntry[1].length)
      .forEach((queryEntry: any[]) => {
        const ids: string[] = [];

        queryEntry[1].forEach((id) => {
          queryParams.push(id);
          ids.push(`$${queryParams.length}`);
        });

        queryAsSQL.push(`${queryEntry[0]} IN (${ids.join(',')})`);
      });

    const result = await pool.query(
      `SELECT * FROM facts WHERE ${queryAsSQL.join(' AND ')}`,
      queryParams,
    );

    return result.rows.map((row) => new Fact(
      row.subject.trim(),
      row.predicate.trim(),
      row.object.trim(),
      logger,
    ));
  }

  constructor(subject: string, predicate: string, object: string, logger?: IsLogger) {
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this.logger = logger;
  }

  async match(factQuery: FactQuery, logger: IsLogger): Promise<boolean> {
    let concreateObjectSpecMatch = false;
    let concreateSubjectSpecMatch = false;
    let subjectMatch;
    let objectMatch;

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
      }, logger);
    }

    if (!concreateObjectSpecMatch) {
      objectMatch = !factQuery.object ? [] : Fact.findAll({
        subject: [this.object, ...factQuery.object],
      }, logger);
    }

    return (concreateSubjectSpecMatch || (await subjectMatch).length !== 0)
      && (concreateObjectSpecMatch || (await objectMatch).length !== 0);
  }

  async matchAny(factQueries: FactQuery[], logger: IsLogger): Promise<boolean> {
    const allResults = await Promise.all(factQueries.map((fq) => this.match(fq, logger)));
    return !!allResults.find((x) => x);
  }

  toJSON() {
    return {
      subject: this.subject,
      predicate: this.predicate,
      object: this.object,
    };
  }

  async save(userid?: string) {
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
}
