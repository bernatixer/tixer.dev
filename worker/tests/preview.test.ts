import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { database } from './sqlite.ts';
import { importPreview } from './preview-seed.ts';
import { previewOwner } from './preview-variants.ts';

test('browser API self-check refuses persistent storage before creating the database', async () => {
  const directory = mkdtempSync(join(process.cwd(), 'tests/.preview-guard-'));
  const path = join(directory, 'must-not-open.sqlite');
  try {
    const require = createRequire(import.meta.url);
    const { build } = createRequire(require.resolve('wrangler/package.json'))('esbuild');
    const script = join(directory, 'server.mjs');
    await build({ entryPoints: ['tests/browser-server.ts'], outfile: script, bundle: true,
      platform: 'node', format: 'esm', packages: 'external', logLevel: 'error' });
    const result = spawnSync(process.execPath, [script, '--self-check'], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, FOCUS_PREVIEW_DB: path, FINANCE_TEST_PORT: '0', OPENAI_API_KEY: '', TELEGRAM_WEBHOOK_SECRET: '' },
    });
    assert.equal(existsSync(path), false, 'self-check must refuse before opening a persistent database');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Self-check requires an in-memory database/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

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

test('preview imports optional goal intake records under its synthetic owner', () => {
  const db = database();
  try {
    db.sqlite.exec('CREATE TABLE IF NOT EXISTS weight_goal_intakes (user_id TEXT NOT NULL, start_date TEXT NOT NULL, intake_kcal INTEGER NOT NULL, PRIMARY KEY (user_id, start_date))');
    importPreview(db, { ...records, goalIntakes: [{ user_id: 'production_owner', start_date: '2026-10-01', intake_kcal: 1700 }] });
    assert.deepEqual(db.sqlite.prepare('SELECT * FROM weight_goal_intakes').all().map(row => ({ ...row })), [
      { user_id: 'synthetic_browser_user', start_date: '2026-10-01', intake_kcal: 1700 },
    ]);
  } finally { db.sqlite.close(); }
});

test('validated preview variants clone current Weight records once with isolated meal identities', () => {
  const db = database();
  try {
    importPreview(db, records);
    db.sqlite.exec("CREATE TABLE IF NOT EXISTS weight_goal_intakes (user_id TEXT NOT NULL, start_date TEXT NOT NULL, intake_kcal INTEGER NOT NULL, PRIMARY KEY (user_id, start_date)); INSERT INTO weight_goal_intakes VALUES ('synthetic_browser_user', '2026-10-01', 1700)");
    db.sqlite.exec("UPDATE weight_entries SET weight_kg = 79; INSERT INTO weight_profiles VALUES ('synthetic_browser_user', 35, 180, 'male', 1.6); INSERT INTO weight_activity VALUES ('synthetic_browser_user', 8000, 'running', 30, 2); INSERT INTO weight_goals VALUES ('synthetic_browser_user', '2026-10-01', 80, '2026-12-01', 75); INSERT INTO telegram_links VALUES ('synthetic_browser_user', '123', 'Europe/Madrid', 8, NULL)");
    const workouts = JSON.stringify([{ sport: 'running', minutesPerSession: 30, sessionsPerWeek: 2 }]);
    db.sqlite.prepare('INSERT INTO weight_activity_extras VALUES (?, ?, ?)').run('synthetic_browser_user', workouts, 1);
    assert.equal(previewOwner(db, null), 'synthetic_browser_user');
    for (const invalid of ['', 'unknown', '../synthetic_browser_user']) assert.throws(() => previewOwner(db, invalid), /Invalid preview variant/);
    const owners = ['north-star', 'goal-phases', 'checkpoints', 'calorie-target', 'reality-forecast'].map(variant => previewOwner(db, variant));
    assert.equal(new Set(owners).size, 5);
    for (const owner of owners) {
      assert.notEqual(owner, 'synthetic_browser_user');
      assert.equal(db.sqlite.prepare('SELECT weight_kg FROM weight_entries WHERE user_id = ?').get(owner)!.weight_kg, 79);
      assert.equal(db.sqlite.prepare('SELECT activity_factor FROM weight_profiles WHERE user_id = ?').get(owner)!.activity_factor, 1.6);
      assert.equal(db.sqlite.prepare('SELECT sport FROM weight_activity WHERE user_id = ?').get(owner)!.sport, 'running');
      assert.deepEqual({ ...db.sqlite.prepare('SELECT workouts, steps_include_runs FROM weight_activity_extras WHERE user_id = ?').get(owner) }, { workouts, steps_include_runs: 1 });
      assert.equal(db.sqlite.prepare('SELECT target_weight_kg FROM weight_goals WHERE user_id = ?').get(owner)!.target_weight_kg, 75);
      assert.equal(db.sqlite.prepare('SELECT intake_kcal FROM weight_goal_intakes WHERE user_id = ?').get(owner)?.intake_kcal, 1700);
      assert.equal(db.sqlite.prepare('SELECT intake_kcal FROM weight_phases WHERE user_id = ?').get(owner)!.intake_kcal, 1900);
      assert.equal(db.sqlite.prepare('SELECT telegram_message_id FROM meals WHERE user_id = ?').get(owner)!.telegram_message_id, null);
      assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM telegram_links WHERE user_id = ?').get(owner)!.n, 0);
    }
    assert.equal(db.sqlite.prepare('SELECT COUNT(DISTINCT id) AS n FROM meals').get()!.n, 6);
    const owner = owners[0];
    db.sqlite.prepare('UPDATE weight_entries SET weight_kg = 70 WHERE user_id = ?').run(owner);
    db.sqlite.prepare('DELETE FROM meals WHERE user_id = ?').run(owner);
    assert.equal(previewOwner(db, 'north-star'), owner);
    assert.equal(db.sqlite.prepare('SELECT weight_kg FROM weight_entries WHERE user_id = ?').get(owner)!.weight_kg, 70);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM meals WHERE user_id = ?').get(owner)!.n, 0);
    assert.equal(db.sqlite.prepare("SELECT weight_kg FROM weight_entries WHERE user_id = 'synthetic_browser_user'").get()!.weight_kg, 79);
  } finally { db.sqlite.close(); }
});

test('preview variant edits remain seeded across database restarts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tixer-variants-'));
  const path = join(directory, 'preview.sqlite');
  try {
    const first = database(path);
    importPreview(first, records);
    const owner = previewOwner(first, 'checkpoints');
    assert.notEqual(owner, 'synthetic_browser_user');
    first.sqlite.prepare('DELETE FROM weight_entries WHERE user_id = ?').run(owner);
    first.sqlite.close();
    const second = database(path);
    try {
      assert.equal(previewOwner(second, 'checkpoints'), owner);
      assert.equal(second.sqlite.prepare('SELECT COUNT(*) AS n FROM weight_entries WHERE user_id = ?').get(owner)!.n, 0);
      assert.equal(second.sqlite.prepare("SELECT COUNT(*) AS n FROM weight_entries WHERE user_id = 'synthetic_browser_user'").get()!.n, 1);
    } finally { second.sqlite.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('failed preview cloning leaves no partial owner and can be retried', () => {
  const db = database();
  try {
    importPreview(db, records);
    const owner = 'synthetic_browser_user:reality-forecast';
    db.sqlite.exec("CREATE TRIGGER fail_clone BEFORE INSERT ON meals WHEN NEW.user_id <> 'synthetic_browser_user' BEGIN SELECT RAISE(ABORT, 'simulated copy failure'); END");
    assert.throws(() => previewOwner(db, 'reality-forecast'), /simulated copy failure/);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM weight_entries WHERE user_id = ?').get(owner)!.n, 0);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM weight_phases WHERE user_id = ?').get(owner)!.n, 0);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM preview_variants WHERE user_id = ?').get(owner)!.n, 0);
    db.sqlite.exec('DROP TRIGGER fail_clone');
    assert.equal(previewOwner(db, 'reality-forecast'), owner);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM meals WHERE user_id = ?').get(owner)!.n, 1);
  } finally { db.sqlite.close(); }
});
