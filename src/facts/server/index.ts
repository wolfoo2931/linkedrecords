/* eslint-disable no-plusplus */
import intersect from 'intersect';
import { FactQuery, SubjectQueries, SubjectQuery } from '../fact_query';
import PgPoolWithLog from '../../../lib/pg-log';
import IsLogger from '../../../lib/is_logger';

function isNotStatement(statement: SubjectQuery): boolean {
  if (!Array.isArray(statement) || !statement[1]) {
    return false;
  }

  return !!statement[1].match(/^\$not\(.+\)$/);
}

function parseLatestModifier(subjectQuery: SubjectQuery): [SubjectQuery, boolean] {
  if (!Array.isArray(subjectQuery) || subjectQuery.length === 3) {
    return [subjectQuery, false];
  }

  const lastModifierMatch = subjectQuery[0].match(/^\$latest\((.+)\)$/);

  if (!lastModifierMatch || !lastModifierMatch[1]) {
    return [subjectQuery, false];
  }

  return [[lastModifierMatch[1], subjectQuery[1]], true];
}

function isNotNotStatement(statement: SubjectQuery): boolean {
  return !isNotStatement(statement);
}

function getExcluded(allConditions: SubjectQueries): string[][] | undefined {
  if (!allConditions) {
    return undefined;
  }

  const checkedArray: SubjectQueries = allConditions
    .filter((c) => c !== undefined && c[0] !== undefined && c[1] !== undefined);

  const notConditions = checkedArray
    .filter(isNotStatement)
    .map((c) => [
      c[0],
      c[1] && c[1]!.match(/^\$not\((.+)\)$/)![1],
    ]);

  return notConditions as string[][];
}

function getSQLClauseByConditions(conditions: string[][] | undefined, placehoderStartIndex = 0, comp = '=', prefix = 'AND ', suffix = ''): [string, string[]] {
  const resultSQL: string[] = [];
  const resultValues: string[] = [];
  let index = 0;

  if (!conditions || !conditions.length) {
    return ['', []];
  }

  conditions.forEach((condition) => {
    if (condition[0] && condition[1]) {
      resultSQL.push(`predicate ${comp} $${index++ + placehoderStartIndex} AND object ${comp} $${index++ + placehoderStartIndex}`);
      resultValues.push(condition[0]);
      resultValues.push(condition[1]);
    }
  });

  return [
    resultSQL.length ? prefix + resultSQL.join(' AND ') + suffix : '',
    resultValues,
  ];
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
    exluded: string[][] | undefined,
    withLatestModifier: boolean,
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

    const resultSet = new Set<string>();
    let previousLength;

    if (query[1] === '$anything' && query[0] && predicatedAllowedToQueryAnyObjects.includes(query[0])) {
      const dbRows = await pool.query('SELECT subject FROM facts WHERE predicate=$1', [query[0]]);
      dbRows.rows.forEach((row) => resultSet.add(row.subject.trim()));
    } else if (query[1] === '$anything') {
      throw new Error(`$anything selector is only allowed in context of the following predicates: ${predicatedAllowedToQueryAnyObjects.join(', ')}`);
    } else {
      let table = 'facts';

      if (withLatestModifier) {
        table = '(SELECT * FROM facts WHERE id IN (SELECT max(id) as latestFact FROM facts WHERE predicate=$1 GROUP BY subject)) as facts';
      }

      let [excludeExtensionSQL, excludeExtensionValues] = getSQLClauseByConditions(exluded, 3, '=', ' AND subject NOT IN (SELECT subject FROM facts WHERE ', ')');

      let dbRows = await pool.query(`SELECT subject FROM ${table} WHERE predicate=$1 AND object=$2 ${excludeExtensionSQL}`, [query[0], query[1], ...excludeExtensionValues]);
      dbRows.rows.forEach((row) => resultSet.add(row.subject.trim()));

      // For now all facts are transitive.
      while (resultSet.size !== previousLength && resultSet.size !== 0) {
        previousLength = resultSet.size;
        const ids = Array.from(resultSet);
        const idsIdexes = ids.map((_, i) => `$${i + 2}`);

        [excludeExtensionSQL, excludeExtensionValues] = getSQLClauseByConditions(exluded, idsIdexes.length + 2, '=', ' AND subject NOT IN (SELECT subject FROM facts WHERE ', ')');

        // eslint-disable-next-line no-await-in-loop
        dbRows = await pool.query(`SELECT subject FROM ${table} WHERE predicate=$1 AND object IN (${idsIdexes.join(',')}) ${excludeExtensionSQL}`, [query[0], ...ids, ...excludeExtensionValues]);

        dbRows.rows.forEach((row) => resultSet.add(row.subject.trim()));
      }
    }

    return Array.from(resultSet);
  }

  static async resolveToSubjectIdsWithModifiers(
    subjectQueries?: SubjectQueries,
    logger?: IsLogger,
  ) {
    if (!subjectQueries) {
      return [];
    }

    const subjectExcluded = getExcluded(subjectQueries.filter(Array.isArray));

    const subjectIdsPromise = subjectQueries
      .filter(isNotNotStatement)
      .map(parseLatestModifier)
      .map((
        [subjectQuery, withLatestModifier],
      ) => Fact.resolveToSubjectIds(subjectQuery, subjectExcluded, withLatestModifier, logger));

    return Promise.all(subjectIdsPromise);
  }

  static async findAll(
    { subject, predicate, object }: FactQuery,
    logger?: IsLogger,
  ): Promise<Fact[]> {
    const pool = new PgPoolWithLog(logger);
    const queryAsSQL: string[] = [];
    const queryParams: string[] = [];
    const subjectIdsPromise = Fact.resolveToSubjectIdsWithModifiers(subject);
    const objectIdsPromise = Fact.resolveToSubjectIdsWithModifiers(object);

    const query: { [key: string]: string[] } = {};

    if (subject) {
      query['subject'] = intersect(await subjectIdsPromise);
    }

    if (predicate) {
      query['predicate'] = predicate;
    }

    if (object) {
      query['object'] = intersect(await objectIdsPromise);
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
