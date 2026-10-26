import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { app } from '../src/index.ts';
import { database } from './sqlite.ts';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const db = database();
after(() => db.sqlite.close());
const env = { DB: db, CLERK_PEM_PUBLIC_KEY: await exportSPKI(publicKey), ZAI_API_KEY: '' };
const token = (sub: string) => new SignJWT({ sub }).setProtectedHeader({ alg: 'RS256' }).setExpirationTime('5m').sign(privateKey);

async function call(user: string, method: string, path: string, body?: unknown) {
  const response = await app.request(`/api/weight${path}`, { method,
    headers: { authorization: `Bearer ${await token(user)}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, env as never);
  return { status: response.status, json: response.status === 204 ? null : response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text() };
}

test('weight entries and phases upsert, list per user, and delete', async () => {
  assert.equal((await call('a', 'PUT', '/entries/2026-10-14', { weightKg: 81 })).status, 200);
  assert.equal((await call('a', 'PUT', '/entries/2026-10-14', { weightKg: 80.9 })).status, 200);
  assert.equal((await call('a', 'PUT', '/entries/2026-10-13', { weightKg: 81.2 })).status, 200);
  assert.equal((await call('a', 'PUT', '/phases/2026-10-14', { maintenanceKcal: 2300, intakeKcal: 1800 })).status, 200);
  assert.equal((await call('a', 'PUT', '/phases/2026-10-01', { maintenanceKcal: 2300, intakeKcal: 1800, proteinPerKg: 9 })).status, 400);
  assert.equal((await call('b', 'PUT', '/entries/2026-10-14', { weightKg: 60 })).status, 200);
  const { entries, phases, meals } = (await call('a', 'GET', '')).json as Record<string, unknown>;
  assert.deepEqual({ entries, phases, meals }, {
    entries: [{ date: '2026-10-13', weightKg: 81.2 }, { date: '2026-10-14', weightKg: 80.9 }],
    phases: [{ startDate: '2026-10-14', maintenanceKcal: 2300, intakeKcal: 1800, proteinPerKg: null }],
    meals: [],
  });
  assert.equal((await call('a', 'DELETE', '/entries/2026-10-13')).status, 204);
  assert.equal((await call('a', 'DELETE', '/phases/2026-10-14')).status, 204);
  const data = (await call('a', 'GET', '')).json as Record<string, unknown>;
  assert.deepEqual({ entries: data.entries, phases: data.phases, meals: data.meals }, { entries: [{ date: '2026-10-14', weightKg: 80.9 }], phases: [], meals: [] });
});

test('weight rejects malformed input', async () => {
  for (const [path, body] of [
    ['/entries/2026-13-01', { weightKg: 80 }], ['/entries/14-10-2026', { weightKg: 80 }],
    ['/entries/2026-10-14', { weightKg: '80' }], ['/entries/2026-10-14', { weightKg: 1000 }],
    ['/phases/2026-10-14', { maintenanceKcal: 2300.5, intakeKcal: 1800 }], ['/phases/2026-10-14', { maintenanceKcal: 2300 }],
  ] as const) assert.equal((await call('a', 'PUT', path, body)).status, 400, path + JSON.stringify(body));
});

test('meal kcal corrections are per user', async () => {
  const today = new Date().toISOString().slice(0, 10);
  db.sqlite.exec(`INSERT INTO meals (id, user_id, date, description, kcal, created_at) VALUES ('meal-a', 'a', '${today}', 'pasta', 700, '${today}T12:00:00Z')`);
  assert.equal((await call('b', 'PUT', '/../meals/meal-a', { kcal: 1 })).status, 404);
  assert.equal((await call('a', 'PUT', '/../meals/meal-a', { kcal: 650.5 })).status, 400);
  assert.equal((await call('a', 'PUT', '/../meals/meal-a', { kcal: 650 })).status, 200);
  const data = (await call('a', 'GET', '')).json as { meals: { kcal: number }[] };
  assert.deepEqual(data.meals.map(meal => meal.kcal), [650]);
  assert.equal((await call('b', 'DELETE', '/../meals/meal-a')).status, 204);
  assert.equal(((await call('a', 'GET', '')).json as { meals: unknown[] }).meals.length, 1, 'another user cannot delete it');
});

test('meal photos must be inline images', async () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const image of ['https://example.com/a.jpg', 'data:text/html;base64,PGgxPg==', 'data:image/png;base64,' + 'A'.repeat(3_000_000)]) {
    assert.equal((await call('a', 'POST', '/../meals', { text: '', image, date: today })).status, 400, image.slice(0, 40));
  }
  assert.equal((await call('a', 'POST', '/../meals', { text: '', date: today })).status, 400, 'needs text or a photo');
});

test('saved profiles remain private and reject invalid equation inputs', async () => {
  assert.deepEqual((await call('profile', 'GET', '')).json, { entries: [], phases: [], meals: [], profile: null, goals: [], days: [] });
  const profile = { age: 35, heightCm: 180, sex: 'male', activityFactor: 1.6 };
  const saved = { ...profile, stepsPerDay: null, sport: null, sportMinutes: null, sportDaysPerWeek: null, workouts: null, stepsIncludeRuns: null };
  assert.deepEqual(await call('profile', 'PUT', '/profile', profile), { status: 200, json: saved });
  assert.deepEqual(((await call('profile', 'GET', '')).json as any).profile, saved);
  assert.equal(((await call('other-profile', 'GET', '')).json as any).profile, null);
  for (const change of [{ age: 0 }, { age: 35.5 }, { heightCm: 0 }, { sex: 'other' }, { activityFactor: 0 }, { heightCm: '180' }]) {
    assert.equal((await call('profile', 'PUT', '/profile', { ...profile, ...change })).status, 400);
  }
});

test('goal versions save the starting average and preserve it after corrected readings', async () => {
  for (const [date, weightKg] of [['2026-10-01', 82], ['2026-10-05', 80], ['2026-10-07', 79], ['2026-10-08', 77]] as const) {
    await call('goal', 'PUT', `/entries/${date}`, { weightKg });
  }
  const first = { startDate: '2026-10-07', startWeightKg: 241 / 3, targetDate: '2026-12-01', targetWeightKg: 75, intakeKcal: null };
  assert.deepEqual(await call('goal', 'PUT', '/goals/2026-10-07', { targetDate: '2026-12-01', targetWeightKg: 75 }), { status: 200, json: first });
  await call('goal', 'PUT', '/entries/2026-10-05', { weightKg: 90 });
  assert.deepEqual(((await call('goal', 'GET', '')).json as any).goals, [first]);
  assert.equal((await call('goal', 'PUT', '/goals/2026-10-08', { targetDate: '2027-01-01', targetWeightKg: 74 })).status, 200);
  assert.equal(((await call('goal', 'GET', '')).json as any).goals.length, 2);
  assert.deepEqual(((await call('other-goal', 'GET', '')).json as any).goals, []);
  assert.equal((await call('other-goal', 'PUT', '/goals/2026-10-08', { targetDate: '2027-01-01', targetWeightKg: 74 })).status, 400, 'a starting weigh-in is required');
  for (const [date, targetDate, targetWeightKg] of [['2026-02-30', '2026-12-01', 75], ['2026-10-07', '2027-02-30', 75], ['2026-10-07', '2026-10-07', 75], ['2026-10-07', '2026-12-01', 100]] as const) {
    assert.equal((await call('goal', 'PUT', `/goals/${date}`, { targetDate, targetWeightKg })).status, 400);
  }
});

test('goal intake can be set, preserved by old clients, cleared, and set to zero', async () => {
  await call('goal-intake', 'PUT', '/entries/2020-01-01', { weightKg: 80 });
  const input = { targetDate: '2020-04-01', targetWeightKg: 75 };
  const first = { startDate: '2020-01-01', startWeightKg: 80, ...input, intakeKcal: 2200 };
  assert.deepEqual(await call('goal-intake', 'PUT', '/goals/2020-01-01', { ...input, intakeKcal: 2200 }), { status: 200, json: first });
  await call('goal-intake', 'PUT', '/entries/2020-01-01', { weightKg: 90 });
  assert.deepEqual((await call('goal-intake', 'PUT', '/goals/2020-01-01', { ...input, targetWeightKg: 74 })).json, { ...first, targetWeightKg: 74 });
  assert.deepEqual((await call('goal-intake', 'PUT', '/goals/2020-01-01', { ...input, intakeKcal: null })).json, { ...first, intakeKcal: null });
  assert.deepEqual((await call('goal-intake', 'PUT', '/goals/2020-01-01', { ...input, intakeKcal: 0 })).json, { ...first, intakeKcal: 0 });
  assert.deepEqual(((await call('goal-intake', 'GET', '')).json as any).goals, [{ ...first, intakeKcal: 0 }]);
  assert.deepEqual(((await call('other-goal-intake', 'GET', '')).json as any).goals, []);
});

test('invalid goal intake leaves the goal and saved intake unchanged', async () => {
  await call('invalid-intake', 'PUT', '/entries/2020-01-01', { weightKg: 80 });
  const input = { targetDate: '2020-04-01', targetWeightKg: 75, intakeKcal: 2000 };
  assert.equal((await call('invalid-intake', 'PUT', '/goals/2020-01-01', input)).status, 200);
  for (const intakeKcal of [-1, 10001, 2000.5, '2000', false, [], {}]) {
    assert.equal((await call('invalid-intake', 'PUT', '/goals/2020-01-01', { ...input, targetWeightKg: 74, intakeKcal })).status, 400, JSON.stringify(intakeKcal));
  }
  assert.deepEqual(((await call('invalid-intake', 'GET', '')).json as any).goals, [{ startDate: '2020-01-01', startWeightKg: 80, ...input }]);
});

test('invalid goal semantics cannot save or clear an intake', async () => {
  await call('goal-semantics', 'PUT', '/entries/2020-01-01', { weightKg: 80 });
  const input = { targetDate: '2020-04-01', targetWeightKg: 75, intakeKcal: 2100 };
  assert.equal((await call('goal-semantics', 'PUT', '/goals/2020-01-01', input)).status, 200);
  for (const intakeKcal of [null, 1000]) {
    assert.equal((await call('goal-semantics', 'PUT', '/goals/2020-01-01', { ...input, targetWeightKg: 90, intakeKcal })).status, 400);
    assert.equal((await call('no-goal-weight', 'PUT', '/goals/2020-01-01', { ...input, intakeKcal })).status, 400);
  }
  assert.deepEqual(((await call('goal-semantics', 'GET', '')).json as any).goals, [{ startDate: '2020-01-01', startWeightKg: 80, ...input }]);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM weight_goal_intakes WHERE user_id = 'no-goal-weight'").get()!.n, 0);
});

test('goal and intake writes roll back together if intake storage fails', async (t) => {
  await call('intake-rollback', 'PUT', '/entries/2020-01-01', { weightKg: 80 });
  const input = { targetDate: '2020-04-01', targetWeightKg: 75, intakeKcal: 2000 };
  const saved = { startDate: '2020-01-01', startWeightKg: 80, ...input };
  assert.deepEqual((await call('intake-rollback', 'PUT', '/goals/2020-01-01', input)).json, saved);
  db.sqlite.exec("CREATE TRIGGER fail_intake BEFORE INSERT ON weight_goal_intakes WHEN NEW.user_id = 'intake-rollback' BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END");
  const log = t.mock.method(console, 'error', () => {});
  try { assert.equal((await call('intake-rollback', 'PUT', '/goals/2020-01-01', { ...input, targetWeightKg: 74, intakeKcal: 1800 })).status, 500); }
  finally { log.mock.restore(); db.sqlite.exec('DROP TRIGGER fail_intake'); }
  assert.deepEqual(((await call('intake-rollback', 'GET', '')).json as any).goals, [saved]);
});

test('manual historical meals bypass AI allowance and keep unknown nutrients', async () => {
  db.sqlite.exec("INSERT INTO meal_estimate_limits (user_id, per_day) VALUES ('manual', 0)");
  const response = await call('manual', 'POST', '/../meals', { date: '2020-01-01', description: 'Known lunch', kcal: 640 });
  assert.equal(response.status, 200);
  assert.deepEqual({ ...(response.json as any), id: undefined, createdAt: undefined }, {
    id: undefined, date: '2020-01-01', description: 'Known lunch', kcal: 640,
    proteinG: null, carbsG: null, fatG: null, saturatedG: null, fibreG: null, sugarG: null, createdAt: undefined,
  });
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM meal_estimate_usage WHERE user_id = 'manual'").get()!.n, 0);
  const overview = (await call('manual', 'GET', '')).json as any;
  assert.deepEqual(overview.meals, [], 'old meal descriptions are loaded on demand');
  assert.deepEqual(overview.days, [{ date: '2020-01-01', kcal: 640, mealCount: 1 }]);
  const detail = (await call('manual', 'GET', '/days/2020-01-01')).json as any;
  assert.deepEqual(detail, { date: '2020-01-01', meals: [response.json] });
  assert.deepEqual((await call('other-manual', 'GET', '/days/2020-01-01')).json, { date: '2020-01-01', meals: [] });
  for (const input of [{ date: '2020-02-30', description: 'x', kcal: 1 }, { date: '2020-01-01', description: '', kcal: 1 }, { date: '2020-01-01', description: 'x', kcal: -1 }]) {
    assert.equal((await call('manual', 'POST', '/../meals', input)).status, 400);
  }
});

test('food summaries follow edits immediately and preserve missing food as unknown', async () => {
  const date = '2020-01-01';
  await call('automatic', 'PUT', `/entries/${date}`, { weightKg: 80 });
  await call('automatic', 'PUT', '/entries/2020-01-02', { weightKg: 79 });
  const create = (kcal: number) => call('automatic', 'POST', '/../meals', { date, description: 'food', kcal });
  const summary = async () => ((await call('automatic', 'GET', '')).json as any).days;
  const first = (await create(100)).json as any;
  const second = (await create(200)).json as any;
  assert.deepEqual(await summary(), [{ date, kcal: 300, mealCount: 2 }, { date: '2020-01-02', kcal: null, mealCount: 0 }]);
  await call('automatic', 'PUT', `/../meals/${first.id}`, { kcal: 150 });
  assert.deepEqual((await summary())[0], { date, kcal: 350, mealCount: 2 });
  await call('other-automatic', 'DELETE', `/../meals/${first.id}`);
  assert.equal((await summary())[0].kcal, 350);
  await call('automatic', 'DELETE', `/../meals/${first.id}`);
  await call('automatic', 'DELETE', `/../meals/${second.id}`);
  assert.deepEqual((await summary())[0], { date, kcal: null, mealCount: 0 });
  await create(0);
  assert.deepEqual((await summary())[0], { date, kcal: 0, mealCount: 1 }, 'a logged zero differs from missing food');
});

test('old food reviews are unused and cannot turn a missing log into zero', async () => {
  db.sqlite.exec("CREATE TABLE IF NOT EXISTS food_day_reviews (user_id TEXT NOT NULL, date TEXT NOT NULL, revision INTEGER NOT NULL, confirmed_revision INTEGER, PRIMARY KEY (user_id, date)); INSERT INTO food_day_reviews VALUES ('old-review', '2020-01-01', 4, 4), ('old-review', '2020-01-02', 0, 0)");
  await call('old-review', 'PUT', '/entries/2020-01-01', { weightKg: 80 });
  assert.deepEqual(((await call('old-review', 'GET', '')).json as any).days, [{ date: '2020-01-01', kcal: null, mealCount: 0 }]);
  assert.equal((await call('old-review', 'PUT', '/day-reviews', { days: [{ date: '2020-01-01', revision: 4 }], complete: true })).status, 404);
  const meal = (await call('old-review', 'POST', '/../meals', { date: '2020-01-01', description: 'lunch', kcal: 400 })).json as any;
  await call('old-review', 'PUT', `/../meals/${meal.id}`, { kcal: 500 });
  await call('old-review', 'DELETE', `/../meals/${meal.id}`);
  assert.deepEqual({ ...db.sqlite.prepare("SELECT revision, confirmed_revision FROM food_day_reviews WHERE user_id = 'old-review' AND date = '2020-01-01'").get() }, { revision: 4, confirmed_revision: 4 });
});

test('failed meal corrections retain the saved calories and nutrients', async (t) => {
  const meal = (await call('rollback', 'POST', '/../meals', { date: '2020-01-01', description: 'food', kcal: 100 })).json as any;
  assert.ok(meal.id, 'manual entry was saved');
  db.sqlite.exec("CREATE TRIGGER fail_meal_update BEFORE UPDATE OF kcal ON meals WHEN NEW.user_id = 'rollback' BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END");
  const log = t.mock.method(console, 'error', () => {});
  try { assert.equal((await call('rollback', 'PUT', `/../meals/${meal.id}`, { kcal: 200 })).status, 500); }
  finally { log.mock.restore(); }
  db.sqlite.exec('DROP TRIGGER fail_meal_update');
  const detail = (await call('rollback', 'GET', '/days/2020-01-01')).json as any;
  assert.deepEqual([detail.meals[0].kcal, detail.meals[0].proteinG], [100, null]);
});

test('profiles save steps and sport per user and normalize no sport', async () => {
  const profile = { age: 35, heightCm: 180, sex: 'male', stepsPerDay: 8500, sport: 'strength', sportMinutes: 60, sportDaysPerWeek: 3 };
  const saved = { ...profile, activityFactor: 1.2, workouts: null, stepsIncludeRuns: null };
  assert.deepEqual(await call('activity', 'PUT', '/profile', profile), { status: 200, json: saved });
  assert.deepEqual(((await call('activity', 'GET', '')).json as any).profile, saved);
  assert.equal(((await call('other-activity', 'GET', '')).json as any).profile, null);
  for (const sport of ['cycling', 'running', 'swimming']) assert.equal((await call('activity', 'PUT', '/profile', { ...profile, sport })).status, 200);
  assert.deepEqual((await call('activity', 'PUT', '/profile', { ...profile, sport: 'none' })).json, { ...saved, sport: 'none', sportMinutes: 0, sportDaysPerWeek: 0 });
  const legacy = { age: 36, heightCm: 180, sex: 'male', activityFactor: 1.6 };
  assert.equal((await call('activity', 'PUT', '/profile', legacy)).status, 200);
  assert.deepEqual(((await call('activity', 'GET', '')).json as any).profile, { ...legacy, stepsPerDay: null, sport: null, sportMinutes: null, sportDaysPerWeek: null, workouts: null, stepsIncludeRuns: null });
});

test('profiles reject partial or out-of-range activity without changing saved data', async () => {
  const profile = { age: 35, heightCm: 180, sex: 'female', stepsPerDay: 0, sport: 'none', sportMinutes: 0, sportDaysPerWeek: 0 };
  assert.equal((await call('invalid-activity', 'PUT', '/profile', profile)).status, 200);
  for (const change of [{ stepsPerDay: -1 }, { stepsPerDay: 100001 }, { stepsPerDay: 1.5 }, { stepsPerDay: '2000' }, { stepsPerDay: null }, { sport: 'tennis' }, { sport: null }, { sport: ['running'] }, { sportMinutes: -1 }, { sportMinutes: 601 }, { sportMinutes: null }, { sportDaysPerWeek: -1 }, { sportDaysPerWeek: 15 }, { sportDaysPerWeek: null }]) {
    assert.equal((await call('invalid-activity', 'PUT', '/profile', { ...profile, ...change })).status, 400, JSON.stringify(change));
  }
  assert.equal((await call('invalid-activity', 'PUT', '/profile', { age: 35, heightCm: 180, sex: 'female', stepsPerDay: 8000 })).status, 400);
  assert.deepEqual(((await call('invalid-activity', 'GET', '')).json as any).profile, { ...profile, activityFactor: 1.2, workouts: null, stepsIncludeRuns: null });
});

test('profile and activity writes fail together without overwriting either saved record', async (t) => {
  const profile = { age: 35, heightCm: 180, sex: 'male', activityFactor: 1.6, stepsPerDay: 8000, sport: 'cycling', sportMinutes: 40, sportDaysPerWeek: 2, workouts: null, stepsIncludeRuns: null };
  assert.equal((await call('activity-rollback', 'PUT', '/profile', profile)).status, 200);
  assert.deepEqual(((await call('activity-rollback', 'GET', '')).json as any).profile, profile);
  db.sqlite.exec("CREATE TRIGGER fail_activity BEFORE INSERT ON weight_activity WHEN NEW.user_id = 'activity-rollback' BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END");
  const log = t.mock.method(console, 'error', () => {});
  try {
    assert.equal((await call('activity-rollback', 'PUT', '/profile', { ...profile, age: 45, stepsPerDay: 9000 })).status, 500);
  } finally { log.mock.restore(); db.sqlite.exec('DROP TRIGGER fail_activity'); }
  assert.deepEqual(((await call('activity-rollback', 'GET', '')).json as any).profile, profile);
});

test('multiple workouts and running-step choice persist without requiring old sport inputs', async () => {
  const profile = { age: 35, heightCm: 180, sex: 'male', stepsPerDay: 9000,
    workouts: [{ sport: 'strength', minutesPerSession: 60, sessionsPerWeek: 3 }, { sport: 'running', minutesPerSession: 30, sessionsPerWeek: 2 }], stepsIncludeRuns: true };
  const saved = { ...profile, activityFactor: 1.2, sport: 'none', sportMinutes: 0, sportDaysPerWeek: 0 };
  assert.deepEqual(await call('multi-sport', 'PUT', '/profile', profile), { status: 200, json: saved });
  assert.deepEqual(((await call('multi-sport', 'GET', '')).json as any).profile, saved);
  assert.equal(((await call('other-sport', 'GET', '')).json as any).profile, null);
  assert.deepEqual((await call('multi-sport', 'PUT', '/profile', { ...profile, workouts: [], stepsIncludeRuns: false })).json,
    { ...saved, workouts: [], stepsIncludeRuns: false });
});

test('invalid workout lists and running-step choices cannot overwrite the profile', async () => {
  const profile = { age: 35, heightCm: 180, sex: 'male', stepsPerDay: 9000, sport: 'none', sportMinutes: 0, sportDaysPerWeek: 0,
    workouts: [{ sport: 'cycling', minutesPerSession: 45, sessionsPerWeek: 2 }], stepsIncludeRuns: false };
  assert.equal((await call('invalid-workout', 'PUT', '/profile', profile)).status, 200);
  for (const change of [
    { workouts: 'running' }, { workouts: Array(9).fill(profile.workouts[0]) }, { workouts: [null] },
    ...[{ sport: 'none' }, { sport: ['running'] }, { minutesPerSession: -1 }, { minutesPerSession: 601 }, { minutesPerSession: '30' }, { sessionsPerWeek: -1 }, { sessionsPerWeek: 15 }, { sessionsPerWeek: null }, { effort: 'extreme' }, { effort: ['hard'] }, { effort: 3 }].map(workout => ({ workouts: [{ ...profile.workouts[0], ...workout }] })),
    { stepsIncludeRuns: 1 }, { stepsIncludeRuns: 'true' },
  ]) assert.equal((await call('invalid-workout', 'PUT', '/profile', { ...profile, ...change })).status, 400, JSON.stringify(change));
  assert.deepEqual(((await call('invalid-workout', 'GET', '')).json as any).profile, { ...profile, activityFactor: 1.2 });
});

test('workout effort survives saving and reading while older workouts remain unchanged', async () => {
  const profile = { age: 35, heightCm: 180, sex: 'male', stepsPerDay: 9000, workouts: [
    { sport: 'strength', minutesPerSession: 45, sessionsPerWeek: 3, effort: 'hard' },
    { sport: 'running', minutesPerSession: 30, sessionsPerWeek: 2, effort: 'normal' },
    { sport: 'cycling', minutesPerSession: 60, sessionsPerWeek: 1, effort: 'easy' },
    { sport: 'swimming', minutesPerSession: 30, sessionsPerWeek: 1 },
  ] };
  const response = await call('workout-effort', 'PUT', '/profile', profile);
  assert.equal(response.status, 200);
  assert.deepEqual((response.json as any).workouts, profile.workouts);
  assert.deepEqual(((await call('workout-effort', 'GET', '')).json as any).profile.workouts, profile.workouts);
  const legacy = { ...profile, workouts: [{ ...profile.workouts[3], effort: null }] };
  assert.equal((await call('workout-effort', 'PUT', '/profile', legacy)).status, 200);
  assert.deepEqual(((await call('workout-effort', 'GET', '')).json as any).profile.workouts, [profile.workouts[3]]);
});

test('running speed and jogging speed persist and invalid speeds cannot replace saved workouts', async () => {
  const profile = { age: 35, heightCm: 180, sex: 'male', stepsPerDay: 9000, workouts: [
    { sport: 'running', speedKmh: 12, minutesPerSession: 30, sessionsPerWeek: 2 },
    { sport: 'jogging', speedKmh: 8, minutesPerSession: 45, sessionsPerWeek: 1 },
  ] };
  assert.equal((await call('workout-speed', 'PUT', '/profile', profile)).status, 200);
  const saved = ((await call('workout-speed', 'GET', '')).json as any).profile;
  assert.deepEqual(saved.workouts, profile.workouts);
  for (const change of [{ speedKmh: 0 }, { speedKmh: 3.9 }, { speedKmh: 23.1 }, { speedKmh: '12' }, { speedKmh: [] }, { speedKmh: true }, { sport: 'strength' }, { sport: 'swimming' }, { sport: 'cycling' }]) {
    assert.equal((await call('workout-speed', 'PUT', '/profile', { ...profile, age: 40, workouts: [{ ...profile.workouts[0], ...change }] })).status, 400);
    assert.deepEqual(((await call('workout-speed', 'GET', '')).json as any).profile, saved);
  }
  assert.equal((await call('workout-speed', 'PUT', '/profile', { ...profile, workouts: [{ ...profile.workouts[0], speedKmh: null }] })).status, 200);
  assert.deepEqual(((await call('workout-speed', 'GET', '')).json as any).profile.workouts, [{ sport: 'running', minutesPerSession: 30, sessionsPerWeek: 2 }]);
});

test('workout save failures roll back profile and activity writes', async (t) => {
  const profile = { age: 35, heightCm: 180, sex: 'male', stepsPerDay: 8000, sport: 'none', sportMinutes: 0, sportDaysPerWeek: 0,
    workouts: [{ sport: 'swimming', minutesPerSession: 30, sessionsPerWeek: 2 }], stepsIncludeRuns: false };
  assert.equal((await call('workout-rollback', 'PUT', '/profile', profile)).status, 200);
  assert.deepEqual(((await call('workout-rollback', 'GET', '')).json as any).profile, { ...profile, activityFactor: 1.2 });
  db.sqlite.exec("CREATE TRIGGER fail_workouts BEFORE INSERT ON weight_activity_extras WHEN NEW.user_id = 'workout-rollback' BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END");
  const log = t.mock.method(console, 'error', () => {});
  try { assert.equal((await call('workout-rollback', 'PUT', '/profile', { ...profile, age: 40, stepsPerDay: 10000, workouts: [] })).status, 500); }
  finally { log.mock.restore(); db.sqlite.exec('DROP TRIGGER fail_workouts'); }
  assert.deepEqual(((await call('workout-rollback', 'GET', '')).json as any).profile, { ...profile, activityFactor: 1.2 });
});
