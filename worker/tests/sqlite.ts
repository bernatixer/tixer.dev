import { chmodSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// boffin: Kept file storage opt-in so test fixtures remain isolated.
export function database(path = ':memory:') {
  const sqlite = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  sqlite.exec(readFileSync('schema.sql', 'utf8'));
  return {
    sqlite,
    async batch(statements: { run(): Promise<unknown> }[]) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    prepare(sql: string) {
      let values: unknown[] = [];
      return {
        bind(...parameters: unknown[]) { values = parameters; return this; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...values), success: true }; },
        async run() { const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: result.changes } }; },
      };
    },
  };
}
