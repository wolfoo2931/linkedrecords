import { Pool } from 'pg';
import IsLogger from '../is_logger';

const pool = new Pool({
  max: 3,
  connectionTimeoutMillis: 2000,
});

export default class PgPoolWithLog {
  logger?: IsLogger;

  pool: Pool;

  constructor(logger: IsLogger) {
    this.logger = logger;
  }

  logResolvedQuery(args) {
    if (!this.logger) {
      console.log('\n\n');
      console.log('\x1b[33m RUN SQL: Logger is Not available!!! \x1b[0m', args);
      console.log('\n\n');

      return;
    }

    let interpolated = args[0];

    if (args[1]) {
      args[1].forEach((arg, i) => {
        interpolated = interpolated.replaceAll(`$${i + 1}`, `'${arg}'`);
      });
    }

    console.log('\n\n');
    console.log(`\x1b[33m RUN SQL: ${interpolated} \x1b[0m`);
    console.log('\n\n');
  }

  async query(...args) {
    let pgresult;

    const startTime = Date.now();

    try {
      pgresult = await pool.query(...args);
    } catch (ex) {
      console.error('\x1b[33m Error Executing query: \x1b[0m', args[0]);
      this.logger?.warn(`\x1b[33m Error Executing query: \x1b[0m ${args[0]}`);
      throw ex;
    }

    const endTime = Date.now();

    if (this.logger) {
      const log = {
        queryTemplate: args[0],
        queryType: pgresult.command,
        timeInMS: endTime - startTime,
        results: pgresult.rowCount,
      };

      this.logger.info(log);
    }

    return pgresult;
  }

  async findAny(...args) {
    const result = await this.query(...args);
    return !!result.rows.length;
  }
}
