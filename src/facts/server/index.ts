import pg from 'pg';
import intersect from 'intersect';

const pgPool = new pg.Pool({ max: 2 });

type FactQuery = {
  subject?: (string | string[])[],
  predicate?: string[],
  object?: (string | string[])[]
};

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

  static async findAll({ subject, predicate, object }:FactQuery): Promise<Fact[]> {
    const subjectIdsPromise = subject ? subject.map(Fact.resolveToAttributeIds) : [];
    const predicateIds = predicate || [];
    const objectIdsPromise = object ? object.map(Fact.resolveToAttributeIds) : [];
    const queryAsSQL: string[] = [];
    const queryParams: string[] = [];

    // FIXME: use splace operator to make the intersect work
    const query: { [key: string]: string[] } = {
      subject: intersect(await Promise.all(subjectIdsPromise)),
      predicate: predicateIds,
      object: intersect(await Promise.all(objectIdsPromise)),
    };

    if (!query['subject'] || !query['object']) {
      throw new Error('empty subjects or objects set in Fact.findAll');
    }

    if (query['subject'].length === 0 && query['object'].length === 0) {
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

  async match(factQuery:FactQuery): Promise<boolean> {
    const subjectConditions = factQuery.subject;
    const predicateConditions = factQuery.predicate;
    const objectConditions = factQuery.object;

    if (predicateConditions && !predicateConditions.includes(this.predicate)) {
      return false;
    }



    return false;
  }

  async save() {
    await pgPool.query('INSERT INTO facts (subject, predicate, object) VALUES ($1, $2, $3)', [
      this.subject,
      this.predicate,
      this.object,
    ]);
  }
}
