import pg from 'pg';

const pool = new pg.Pool({
  max: 3,
  connectionTimeoutMillis: 2000,
});

const pgPool = {
  query: async function query(...args) {
    const startTime = Date.now();
    const pgresult = await pool.query(...args);
    const endTime = Date.now();

    const log = {
      queryTemplate: args[0],
      query: pgresult.command,
      timeInMS: endTime - startTime,
      results: pgresult.rowCount,
    };

    console.log(JSON.stringify(log));

    return pgresult;
  },
};

export default pgPool;
