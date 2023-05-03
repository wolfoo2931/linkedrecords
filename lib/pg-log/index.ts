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
