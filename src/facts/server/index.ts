import intersect from 'intersect';
import { FactQuery } from '../fact_query';
import PgPoolWithLog from '../../../lib/pg-log';
import IsLogger from '../../../lib/is_logger';

const ensureArray = (a) => (Array.isArray(a) ? a : [a]);
export default class Fact {
  subject: string;

  predicate: string;

  object: string;

  logger?: IsLogger;

  static async initDB() {
    const createQuery = 'CREATE TABLE IF NOT EXISTS facts (subject CHAR(40), predicate CHAR(40), object TEXT);';
    await (new PgPoolWithLog()).query(createQuery);
  }

  private static async resolveToAttributeIds(
    query: string | string[],
    logger?: IsLogger,
  ): Promise<string[]> {
    const pool = new PgPoolWithLog(logger);
    const predicatedAllowedToQueryAnyObjects = ['$isATermFor'];

    if (typeof query === 'string') {
      return [query];
    }

    if (!query || !query.length || query.length !== 2) {
      throw new Error('resolveToAttributeIds must be string or array with two elements');
    }

    const resultSet = new Set<string>();
    let previousLength;

    if (query[1] === '$anything' && query[0] && predicatedAllowedToQueryAnyObjects.includes(query[0])) {
      const dbRows = await pool.query('SELECT subject FROM facts WHERE predicate=$1', [query[0]]);
      dbRows.rows.forEach((row) => resultSet.add(row.subject.trim()));
    } else if (query[1] === '$anything') {
      throw new Error(`$anything selector is only allowed in context of the following predicates: ${predicatedAllowedToQueryAnyObjects.join(', ')}`);
    } else {
      let dbRows = await pool.query('SELECT subject FROM facts WHERE predicate=$1 AND object=$2', [query[0], query[1]]);
      dbRows.rows.forEach((row) => resultSet.add(row.subject.trim()));

      // For now all facts are transitive.
      while (resultSet.size !== previousLength && resultSet.size !== 0) {
        previousLength = resultSet.size;
        // TODO: run in parallel - or better - compose a single query
        // TODO: Make sure sql injections do not work here
        // eslint-disable-next-line no-await-in-loop
        dbRows = await pool.query(`SELECT subject FROM facts WHERE predicate=$1 AND object IN (${Array.from(resultSet).map((sub) => `'${sub}'`).join(',')})`, [query[0]]);
        dbRows.rows.forEach((row) => resultSet.add(row.subject.trim()));
      }
    }

    return Array.from(resultSet);
  }

  static async findAll(
    { subject, predicate, object }: FactQuery,
    logger?: IsLogger,
  ): Promise<Fact[]> {
    const pool = new PgPoolWithLog(logger);
    const subjectIdsPromise = subject
      ? ensureArray(subject).map((s) => Fact.resolveToAttributeIds(s, logger))
      : [];
    const objectIdsPromise = object
      ? ensureArray(object).map((o) => Fact.resolveToAttributeIds(o, logger))
      : [];
    const queryAsSQL: string[] = [];
    const queryParams: string[] = [];

    const query: { [key: string]: string[] } = {};

    if (subject) {
      query['subject'] = intersect(await Promise.all(subjectIdsPromise));
    }

    if (predicate) {
      query['predicate'] = predicate;
    }

    if (object) {
      query['object'] = intersect(await Promise.all(objectIdsPromise));
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

  async save(userid?) {
    const pool = new PgPoolWithLog(this.logger);

    if (this.predicate === '$isATermFor') {
      const dbRows = await pool.query('SELECT subject FROM facts WHERE subject=$1 AND predicate=$2', [this.subject, this.predicate]);

      if (!dbRows.rows.length) {
        if (!userid) {
          throw new Error('In order to save a $isATermFor fact a userid has to be provided as a parameter of the fact.save method.');
        }

        await pool.query('INSERT INTO facts (subject, predicate, object) VALUES ($1, $2, $3), ($1, $4, $5)', [
          this.subject,
          this.predicate,
          this.object,
          '$wasCreatedBy',
          userid,
        ]);
      }
    } else {
      await pool.query('INSERT INTO facts (subject, predicate, object) VALUES ($1, $2, $3)', [
        this.subject,
        this.predicate,
        this.object,
      ]);
    }
  }
}
