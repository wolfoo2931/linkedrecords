import type { DbClient } from './index';

let instance: DbClient | null = null;
let instanceDataDir: string | undefined;

export default async function createPgliteClient(dataDir?: string): Promise<DbClient> {
  if (instance) {
    if (dataDir !== instanceDataDir) {
      throw new Error(
        `createPgliteClient: existing PGlite instance was created with dataDir=${JSON.stringify(instanceDataDir)} `
        + `but is now requested with dataDir=${JSON.stringify(dataDir)}. `
        + 'Set PGLITE_DATA_DIR before the first query and do not change it at runtime.',
      );
    }
    return instance;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PGlite } = await import('@electric-sql/pglite');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prepareValue } = await import('pg/lib/utils');

  instanceDataDir = dataDir;
  const db = dataDir !== undefined ? new PGlite(dataDir) : new PGlite();

  instance = {
    async query(text: string, values?: any[]) {
      if (!values || values.length === 0) {
        // Use exec() (simple query protocol) so multi-statement strings are accepted.
        // exec() returns an array of results; return the last one.
        const results = await db.exec(text);
        const last = results[results.length - 1] ?? { rows: [], affectedRows: 0 };
        return {
          rows: last.rows,
          rowCount: last.affectedRows ?? null,
          command: undefined,
        };
      }
      // PGlite doesn't auto-serialize parameter values the way pg does (Date → string,
      // object → JSON string, etc.), so we apply pg's prepareValue before passing them.
      const prepared = values.map(prepareValue);
      const result = await db.query(text, prepared);
      return {
        rows: result.rows,
        rowCount: result.affectedRows ?? null,
        command: undefined,
      };
    },
  };

  return instance;
}