import pg from 'pg';
import { expect } from 'chai';

const pgPool = new pg.Pool({ max: 2 });

// eslint-disable-next-line import/prefer-default-export
export async function expectFactToExists(fact: [string, string, string]) {
  const results = await pgPool.query('SELECT * FROM facts WHERE subject=$1 AND predicate=$2 AND object=$3', fact);

  expect(results.rows.length).to.be.greaterThan(0);
}

export async function expectFactToNotExists(fact: [string, string, string]) {
  const results = await pgPool.query('SELECT * FROM facts WHERE subject=$1 AND predicate=$2 AND object=$3', fact);

  expect(results.rows.length).to.eq(0);
}
