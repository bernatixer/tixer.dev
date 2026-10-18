import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function database() {
  const sqlite = new DatabaseSync(':memory:');
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
