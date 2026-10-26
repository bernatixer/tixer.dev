import type { database } from './sqlite.ts';

const variants = ['north-star', 'goal-phases', 'checkpoints', 'calorie-target', 'reality-forecast'];
const source = 'synthetic_browser_user';

export function previewOwner(db: ReturnType<typeof database>, variant: string | null) {
  if (variant === null) return source;
  if (!variants.includes(variant)) throw new RangeError('Invalid preview variant');
  const owner = `${source}:${variant}`;
  db.sqlite.exec('CREATE TABLE IF NOT EXISTS preview_variants (variant TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE)');
  db.sqlite.exec('BEGIN IMMEDIATE');
  try {
    if (!db.sqlite.prepare('SELECT 1 FROM preview_variants WHERE variant = ?').get(variant)) {
      const tables = [
        ['weight_entries', ['date', 'weight_kg']],
        ['weight_phases', ['start_date', 'maintenance_kcal', 'intake_kcal', 'protein_g_per_kg']],
        ['weight_profiles', ['age', 'height_cm', 'sex', 'activity_factor']],
        ['weight_activity', ['steps_per_day', 'sport', 'sport_minutes', 'sport_days_per_week']],
        ['weight_activity_extras', ['workouts', 'steps_include_runs']],
        ['weight_goals', ['start_date', 'start_weight_kg', 'target_date', 'target_weight_kg']],
        ['weight_goal_intakes', ['start_date', 'intake_kcal']],
        ['meals', ['id', 'date', 'description', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'saturated_g', 'fibre_g', 'sugar_g', 'created_at']],
      ] as const;
      // boffin: published the clone only after every local Weight record copied successfully.
      for (const [table, columns] of tables) {
        const rows = db.sqlite.prepare(`SELECT ${columns.join(', ')} FROM ${table} WHERE user_id = ?`).all(source);
        const insert = db.sqlite.prepare(`INSERT INTO ${table} (user_id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})`);
        for (const row of rows) insert.run(owner, ...columns.map(column => column === 'id' ? crypto.randomUUID() : row[column]));
      }
      db.sqlite.prepare('INSERT INTO preview_variants (variant, user_id) VALUES (?, ?)').run(variant, owner);
    }
    db.sqlite.exec('COMMIT');
    return owner;
  } catch (error) {
    db.sqlite.exec('ROLLBACK');
    throw error;
  }
}
