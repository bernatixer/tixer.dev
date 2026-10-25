import type { database } from './sqlite.ts';

type PreviewRecords = { entries: Record<string, unknown>[]; phases: Record<string, unknown>[]; meals: Record<string, unknown>[] };

export function importPreview(db: ReturnType<typeof database>, records: PreviewRecords) {
  const tables = [
    ['weight_entries', records.entries, ['date', 'weight_kg']],
    ['weight_phases', records.phases, ['start_date', 'maintenance_kcal', 'intake_kcal', 'protein_g_per_kg']],
    ['meals', records.meals, ['id', 'date', 'description', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'saturated_g', 'fibre_g', 'sugar_g', 'created_at']],
  ] as const;
  if (tables.some(([, rows]) => !Array.isArray(rows))) throw new Error('Invalid preview export');
  db.sqlite.exec('BEGIN IMMEDIATE');
  try {
    if (db.sqlite.prepare(`SELECT (SELECT COUNT(*) FROM weight_entries) + (SELECT COUNT(*) FROM weight_phases)
        + (SELECT COUNT(*) FROM meals) AS n`).get()!.n !== 0) throw new Error('Preview database is not empty');
    // boffin: Copied only approved fields under a local identity, excluding Telegram identifiers.
    for (const [table, rows, columns] of tables) {
      const statement = db.sqlite.prepare(`INSERT INTO ${table} (user_id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})`);
      for (const row of rows) {
        const values = columns.map(column => {
          const value = row[column] ?? null;
          if (value !== null && typeof value !== 'string' && typeof value !== 'number') throw new Error('Invalid preview field');
          return value;
        });
        statement.run('synthetic_browser_user', ...values);
      }
    }
    db.sqlite.exec('COMMIT');
  } catch (error) {
    db.sqlite.exec('ROLLBACK');
    throw error;
  }
}
