import pg from 'pg';
import intersect from 'intersect';
import { FactQuery } from '../fact_query';

const pgPool = new pg.Pool({ max: 2 });
const ensureArray = (a) => (Array.isArray(a) ? a : [a]);
export default class Fact {
  subject: string;

  predicate: string;

  object: string;

  static async initDB() {
    const createQuery = 'CREATE TABLE IF NOT EXISTS facts (subject CHAR(40), predicate CHAR(40), object CHAR(40));';
    await pgPool.query(createQuery);
  }

  static async deleteAll() {
    const createQuery = 'TRUNCATE facts;';
    await pgPool.query(createQuery);
  }

  static async resolveToAttributeIds(query: string | string[]): Promise<string[]> {
    if (typeof query === 'string') {
      return [query];
    }

    if (!query || !query.length || query.length !== 2) {
      throw new Error('resolveToAttributeIds must be string or array with two elements');
    }

    const resultSet = new Set<string>();
    let previousLength;

    let dbRows = await pgPool.query('SELECT subject FROM facts WHERE predicate=$1 AND object=$2', [query[0], query[1]]);
    dbRows.rows.forEach((row) => resultSet.add(row.subject.trim()));

    while (resultSet.size !== previousLength && resultSet.size !== 0) {
      previousLength = resultSet.size;
      // eslint-disable-next-line no-await-in-loop
      dbRows = await pgPool.query(`SELECT subject FROM facts WHERE predicate=$1 AND object IN (${Array.from(resultSet).map((sub) => `'${sub}'`).join(',')})`, [query[0]]);
      dbRows.rows.forEach((row) => resultSet.add(row.subject.trim()));
    }

    return Array.from(resultSet);
  }

  static async findAll({ subject, predicate, object }: FactQuery): Promise<Fact[]> {
    const subjectIdsPromise = subject ? ensureArray(subject).map(Fact.resolveToAttributeIds) : [];
    const objectIdsPromise = object ? ensureArray(object).map(Fact.resolveToAttributeIds) : [];
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

    const result = await pgPool.query(
      `SELECT * FROM facts WHERE ${queryAsSQL.join(' AND ')}`,
      queryParams,
    );

    return result.rows.map((row) => new Fact(
      row.subject.trim(),
      row.predicate.trim(),
      row.object.trim(),
    ));
  }

  constructor(subject: string, predicate: string, object: string) {
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
  }

  async match(factQuery: FactQuery): Promise<boolean> {
    let concreateObjectSpecMatch;
    let concreateSubjectSpecMatch;
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
      });
    }

    if (!concreateObjectSpecMatch) {
      objectMatch = !factQuery.object ? [] : Fact.findAll({
        subject: [this.object, ...factQuery.object],
      });
    }

    return (concreateSubjectSpecMatch || (await subjectMatch).length !== 0)
      && (concreateObjectSpecMatch || (await objectMatch).length !== 0);
  }

  async matchAny(factQueries: FactQuery[]): Promise<boolean> {
    const allResults = await Promise.all(factQueries.map((fq) => this.match(fq)));
    return !!allResults.find((x) => x);
  }

  async save() {
    await pgPool.query('INSERT INTO facts (subject, predicate, object) VALUES ($1, $2, $3)', [
      this.subject,
      this.predicate,
      this.object,
    ]);
  }
}
