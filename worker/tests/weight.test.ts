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
  return { status: response.status, json: response.status === 204 ? null : await response.json() };
}

test('weight entries and phases upsert, list per user, and delete', async () => {
  assert.equal((await call('a', 'PUT', '/entries/2026-10-14', { weightKg: 81 })).status, 200);
  assert.equal((await call('a', 'PUT', '/entries/2026-10-14', { weightKg: 80.9 })).status, 200);
  assert.equal((await call('a', 'PUT', '/entries/2026-10-13', { weightKg: 81.2 })).status, 200);
  assert.equal((await call('a', 'PUT', '/phases/2026-10-14', { maintenanceKcal: 2300, intakeKcal: 1800 })).status, 200);
  assert.equal((await call('b', 'PUT', '/entries/2026-10-14', { weightKg: 60 })).status, 200);
  assert.deepEqual((await call('a', 'GET', '')).json, {
    entries: [{ date: '2026-10-13', weightKg: 81.2 }, { date: '2026-10-14', weightKg: 80.9 }],
    phases: [{ startDate: '2026-10-14', maintenanceKcal: 2300, intakeKcal: 1800 }],
    meals: [], closedDays: [],
  });
  assert.equal((await call('a', 'DELETE', '/entries/2026-10-13')).status, 204);
  assert.equal((await call('a', 'DELETE', '/phases/2026-10-14')).status, 204);
  assert.deepEqual((await call('a', 'GET', '')).json, { entries: [{ date: '2026-10-14', weightKg: 80.9 }], phases: [], meals: [], closedDays: [] });
});

test('weight rejects malformed input', async () => {
  for (const [path, body] of [
    ['/entries/2026-13-01', { weightKg: 80 }], ['/entries/14-10-2026', { weightKg: 80 }],
    ['/entries/2026-10-14', { weightKg: '80' }], ['/entries/2026-10-14', { weightKg: 1000 }],
    ['/phases/2026-10-14', { maintenanceKcal: 2300.5, intakeKcal: 1800 }], ['/phases/2026-10-14', { maintenanceKcal: 2300 }],
  ] as const) assert.equal((await call('a', 'PUT', path, body)).status, 400, path + JSON.stringify(body));
});

test('meal kcal corrections and day closing are per user', async () => {
  const today = new Date().toISOString().slice(0, 10);
  db.sqlite.exec(`INSERT INTO meals (id, user_id, date, description, kcal, created_at) VALUES ('meal-a', 'a', '${today}', 'pasta', 700, '${today}T12:00:00Z')`);
  assert.equal((await call('b', 'PUT', '/../meals/meal-a', { kcal: 1 })).status, 404);
  assert.equal((await call('a', 'PUT', '/../meals/meal-a', { kcal: 650.5 })).status, 400);
  assert.equal((await call('a', 'PUT', '/../meals/meal-a', { kcal: 650 })).status, 200);
  assert.equal((await call('a', 'PUT', `/../meal-days/${today}`, { closed: true })).status, 200);
  const data = (await call('a', 'GET', '')).json as { meals: { kcal: number }[]; closedDays: string[] };
  assert.deepEqual([data.meals.map(meal => meal.kcal), data.closedDays], [[650], [today]]);
  assert.equal((await call('b', 'DELETE', '/../meals/meal-a')).status, 204);
  assert.equal(((await call('a', 'GET', '')).json as { meals: unknown[] }).meals.length, 1, 'another user cannot delete it');
});
