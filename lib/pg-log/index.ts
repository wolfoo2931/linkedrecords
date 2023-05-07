import { Pool } from 'pg';
import IsLogger from '../is_logger';

const pool = new Pool({
  max: 3,
  connectionTimeoutMillis: 2000,
});

export default class PgPoolWithLog {
  logger?: IsLogger;

  pool: Pool;

  constructor(logger?: IsLogger) {
    this.logger = logger;
  }

  async query(...args) {
    const startTime = Date.now();
    const pgresult = await pool.query(...args);
    const endTime = Date.now();

    let interpolated = args[0];

    if (args[1]) {
      args[1].forEach((arg, i) => {
        interpolated = interpolated.replaceAll(`$${i + 1}`, `'${arg}'`);
      });
    }

    console.log(`\x1b[33m RUN SQL: ${interpolated} \x1b[0m`);

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
}
