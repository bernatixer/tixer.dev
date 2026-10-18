import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { app } from '../src/index.ts';
import { parseWeight, sendReminders } from '../src/handlers/telegram.ts';
import { parseEstimate } from '../src/handlers/meals.ts';
import { database } from './sqlite.ts';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const db = database();
after(() => db.sqlite.close());
const env = { DB: db, CLERK_PEM_PUBLIC_KEY: await exportSPKI(publicKey), ZAI_API_KEY: 'zai-key', TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_WEBHOOK_SECRET: 'hook-secret' };
const token = (sub: string) => new SignJWT({ sub }).setProtectedHeader({ alg: 'RS256' }).setExpirationTime('5m').sign(privateKey);

// Outbound calls (Telegram, z.ai) are recorded and answered from `zai` / canned Telegram results.
const calls: { url: string; body: any }[] = [];
let zai = '{"is_food": true, "items": [{"name": "eggs", "kcal": 180}, {"name": "toast", "kcal": 90}]}';
globalThis.fetch = (async (input: string, init?: RequestInit) => {
  const url = String(input), body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, body });
  if (url.includes('api.z.ai')) return Response.json({ choices: [{ message: { content: `Thinking... ${zai}` } }] });
  if (url.endsWith('/getFile')) return Response.json({ ok: true, result: { file_path: 'photos/p.jpg' } });
  if (url.includes('/file/bot')) return new Response(new Uint8Array([1, 2, 3]));
  return Response.json({ ok: true, result: { message_id: 55 } });
}) as typeof fetch;

async function telegram(chatId: number, text: string, secret = 'hook-secret', extra: Record<string, unknown> = {}) {
  const pending: Promise<unknown>[] = [];
  const response = await app.request('/api/telegram/webhook', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify({ message: { chat: { id: chatId }, text, ...extra } }) }, env as never,
    { waitUntil: (promise: Promise<unknown>) => pending.push(promise), passThroughOnException() {} } as never);
  await Promise.all(pending);
  return { status: response.status, body: response.status === 200 ? await response.json() as { text: string; action?: string } : null };
}

async function api(user: string, method: string, path: string, body?: unknown) {
  const response = await app.request(`/api/telegram${path}`, { method,
    headers: { authorization: `Bearer ${await token(user)}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, env as never);
  return { status: response.status, json: response.status === 204 ? null : await response.json() };
}

test('weights parse from plain replies only', () => {
  assert.equal(parseWeight('80,6'), 80.6);
  assert.equal(parseWeight(' 80.65 kg '), 80.65);
  for (const text of ['hello', '8', '80.6.1', '1000', '/start']) assert.equal(parseWeight(text), null, text);
});

test('the webhook rejects requests without the Telegram secret', async () => {
  assert.equal((await telegram(1, '/start', 'wrong')).status, 403);
});

test('a bot code links the chat, and replies log weight for that user', async () => {
  const code = (await telegram(42, '/start')).body!.text.match(/code is (\w+)/)![1];
  assert.equal((await api('alice', 'POST', '/link', { code: 'NOPE00', timeZone: 'Europe/Madrid', remindHour: 8 })).status, 404);
  assert.equal((await api('alice', 'POST', '/link', { code, timeZone: 'Mars/Base', remindHour: 8 })).status, 400);
  assert.equal((await api('alice', 'POST', '/link', { code: code.toLowerCase(), timeZone: 'Europe/Madrid', remindHour: 8 })).status, 200);
  assert.equal((await api('bob', 'POST', '/link', { code, timeZone: 'Europe/Madrid', remindHour: 8 })).status, 404, 'codes are single-use');
  assert.deepEqual((await api('alice', 'GET', '')).json, { linked: true, timeZone: 'Europe/Madrid', remindHour: 8 });

  assert.equal((await telegram(42, '80,6')).body!.text, '✓ 80.60 kg logged');
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM weight_entries WHERE user_id = 'alice' AND weight_kg = 80.6").get()!.n, 1);
  assert.match((await telegram(99, '80.6')).body!.text, /Your code is/, 'unlinked chats get a code, not a log');

  assert.equal((await api('alice', 'DELETE', '')).status, 204);
  assert.deepEqual((await api('alice', 'GET', '')).json, { linked: false });
});

test('meal estimates parse from wrapped JSON and reject non-food', () => {
  assert.deepEqual(parseEstimate('ok {"is_food": true, "items": [{"name": "salad", "kcal": 580.4}, {"name": "coke", "kcal": 140}]} done'),
    { items: [{ name: 'salad', kcal: 580 }, { name: 'coke', kcal: 140 }], totalKcal: 720 });
  assert.equal(parseEstimate('{"is_food": false, "items": []}'), null);
  assert.equal(parseEstimate('no json here'), null);
});

test('meals log from text and photos, correct by reply, and days close with done', async () => {
  db.sqlite.exec("DELETE FROM telegram_links; DELETE FROM meals; DELETE FROM meal_days;");
  db.sqlite.exec("INSERT INTO telegram_links (user_id, chat_id, time_zone, remind_hour) VALUES ('m', '7', 'Europe/Madrid', 8)");
  calls.length = 0;
  assert.equal((await telegram(7, '2 eggs and toast')).body!.action, 'typing');
  assert.match(calls.at(-1)!.body.text, /≈ 270 kcal\n• eggs · 180\n• toast · 90/);
  assert.deepEqual(db.sqlite.prepare("SELECT description, kcal, telegram_message_id AS mid FROM meals WHERE user_id = 'm'").all().map(row => ({ ...row })),
    [{ description: '2 eggs and toast', kcal: 270, mid: 55 }]);

  assert.equal((await telegram(7, '320', 'hook-secret', { reply_to_message: { message_id: 55 } })).body!.text, '✓ Updated to 320 kcal');
  assert.equal(db.sqlite.prepare("SELECT kcal FROM meals WHERE user_id = 'm'").get()!.kcal, 320);

  calls.length = 0;
  await telegram(7, '', 'hook-secret', { photo: [{ file_id: 'small' }, { file_id: 'big' }] });
  assert.equal(calls[0].body.file_id, 'big');
  const sentToZai = JSON.stringify(calls.find(call => call.url.includes('api.z.ai'))!.body);
  assert.ok(sentToZai.includes('data:image/jpeg;base64,AQID'), 'the photo travels as data');
  assert.ok(!sentToZai.includes('bot-token'), 'the bot token never reaches the estimator');
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM meals WHERE user_id = 'm'").get()!.n, 2);

  zai = '{"is_food": false, "items": []}';
  await telegram(7, 'what is the weather');
  assert.match(calls.at(-1)!.body.text, /doesn’t look like food/);
  zai = '{"is_food": true, "items": [{"name": "eggs", "kcal": 180}, {"name": "toast", "kcal": 90}]}';

  assert.equal((await telegram(7, 'Done')).body!.text, '✓ Day closed');
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM meal_days WHERE user_id = 'm'").get()!.n, 1);
});

test('the evening close-out asks once, only for open days with meals', async () => {
  db.sqlite.exec("DELETE FROM telegram_links; DELETE FROM meals; DELETE FROM meal_days; DELETE FROM telegram_nudges;");
  db.sqlite.exec("INSERT INTO telegram_links (user_id, chat_id, time_zone, remind_hour) VALUES ('open', '1', 'Europe/Madrid', 8), ('closed', '2', 'Europe/Madrid', 8), ('none', '3', 'Europe/Madrid', 8)");
  db.sqlite.exec("INSERT INTO meals (id, user_id, date, description, kcal, created_at) VALUES ('1', 'open', '2026-10-18', 'x', 500, ''), ('2', 'closed', '2026-10-18', 'x', 500, '')");
  db.sqlite.exec("INSERT INTO meal_days (user_id, date) VALUES ('closed', '2026-10-18')");
  const sent: string[] = [];
  const send = (async (_url: string, init: RequestInit) => { sent.push(JSON.parse(String(init.body)).chat_id); return Response.json({ ok: true }); }) as typeof fetch;
  const ninePmInMadrid = new Date('2026-10-18T19:00:00Z');
  await sendReminders(env as never, ninePmInMadrid, send);
  await sendReminders(env as never, ninePmInMadrid, send);
  assert.deepEqual(sent, ['1']);
});

test('reminders go once, at the local hour, and only when today is empty', async () => {
  db.sqlite.exec("DELETE FROM telegram_links; DELETE FROM weight_entries;");
  db.sqlite.exec("INSERT INTO telegram_links (user_id, chat_id, time_zone, remind_hour) VALUES ('a', '1', 'Europe/Madrid', 8), ('b', '2', 'Europe/Madrid', 8), ('c', '3', 'Asia/Tokyo', 8)");
  db.sqlite.exec("INSERT INTO weight_entries (user_id, date, weight_kg) VALUES ('b', '2026-10-18', 80)");
  const sent: string[] = [];
  const send = (async (_url: string, init: RequestInit) => { sent.push(JSON.parse(String(init.body)).chat_id); return Response.json({ ok: true }); }) as typeof fetch;
  const eightInMadrid = new Date('2026-10-18T06:00:00Z');
  await sendReminders(env as never, eightInMadrid, send);
  await sendReminders(env as never, eightInMadrid, send);
  assert.deepEqual(sent, ['1']);
});
