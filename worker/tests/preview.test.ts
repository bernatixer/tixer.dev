import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { database } from './sqlite.ts';
import { importPreview } from './preview-seed.ts';

test('an explicit preview database keeps local edits across restarts while default tests stay isolated', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tixer-preview-'));
  const path = join(directory, 'preview.sqlite');
  try {
    const first = database(path);
    await first.prepare('INSERT INTO weight_entries (user_id, date, weight_kg) VALUES (?, ?, ?)')
      .bind('synthetic_browser_user', '2026-10-01', 80).run();
    first.sqlite.close();

    const reopened = database(path);
    try {
      const rows = await reopened.prepare('SELECT date, weight_kg FROM weight_entries').all();
      assert.deepEqual(rows.results.map(row => ({ ...row })), [{ date: '2026-10-01', weight_kg: 80 }]);
    } finally { reopened.sqlite.close(); }

    const isolated = database();
    try { assert.equal((await isolated.prepare('SELECT COUNT(*) AS n FROM weight_entries').first())!.n, 0); }
    finally { isolated.sqlite.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

const records = {
  entries: [{ user_id: 'production_owner', date: '2026-10-01', weight_kg: 80 }],
  phases: [{ user_id: 'production_owner', start_date: '2026-10-01', maintenance_kcal: 2400, intake_kcal: 1900, protein_g_per_kg: 1.6 }],
  meals: [{ id: 'original-meal', user_id: 'production_owner', date: '2026-10-01', description: 'Test meal', kcal: 500,
    protein_g: 30, carbs_g: 40, fat_g: 20, saturated_g: 3, fibre_g: 8, sugar_g: 5,
    telegram_message_id: 123, created_at: '2026-10-01T12:00:00Z' }],
};

test('preview import preserves records under its synthetic user and excludes Telegram identifiers', () => {
  const db = database();
  try {
    importPreview(db, records);
    const entry = db.sqlite.prepare('SELECT * FROM weight_entries').get();
    assert.deepEqual({ ...entry }, { user_id: 'synthetic_browser_user', date: '2026-10-01', weight_kg: 80 });
    assert.deepEqual({ ...db.sqlite.prepare('SELECT user_id, start_date, protein_g_per_kg FROM weight_phases').get() }, {
      user_id: 'synthetic_browser_user', start_date: '2026-10-01', protein_g_per_kg: 1.6,
    });
    const meal = db.sqlite.prepare('SELECT * FROM meals').get()!;
    assert.equal(meal.id, 'original-meal');
    assert.equal(meal.user_id, 'synthetic_browser_user');
    assert.equal(meal.telegram_message_id, null);
    assert.equal(meal.created_at, '2026-10-01T12:00:00Z');
    assert.equal(meal.protein_g, 30);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM telegram_links').get()!.n, 0);
    assert.throws(() => importPreview(db, records), /not empty/);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM meals').get()!.n, 1);
  } finally { db.sqlite.close(); }
});

test('preview import rolls back the whole copy when one record cannot be stored', () => {
  const db = database();
  try {
    assert.throws(() => importPreview(db, { ...records, meals: [{ ...records.meals[0], kcal: null }] }));
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM weight_entries').get()!.n, 0);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM weight_phases').get()!.n, 0);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM meals').get()!.n, 0);
  } finally { db.sqlite.close(); }
});
