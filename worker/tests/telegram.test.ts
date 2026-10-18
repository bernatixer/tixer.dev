import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { app } from '../src/index.ts';
import { mealDate, parseWeight, sendReminders } from '../src/handlers/telegram.ts';
import { parseEstimate } from '../src/handlers/meals.ts';
import { database } from './sqlite.ts';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const db = database();
after(() => db.sqlite.close());
const env = { DB: db, CLERK_PEM_PUBLIC_KEY: await exportSPKI(publicKey), ZAI_API_KEY: '', OPENAI_API_KEY: 'openai-key', TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_WEBHOOK_SECRET: 'hook-secret' };
const token = (sub: string) => new SignJWT({ sub }).setProtectedHeader({ alg: 'RS256' }).setExpirationTime('5m').sign(privateKey);

// Outbound calls (Telegram, OpenAI) are recorded and answered from `estimate` / canned Telegram results.
const calls: { url: string; body: any }[] = [];
let estimate = '{"is_food": true, "title": "Eggs & toast", "emoji": "🍳", "items": [{"name": "eggs", "kcal": 180, "protein_g": 12, "fat_g": 12}, {"name": "toast", "kcal": 90, "protein_g": 3, "carbs_g": 16, "fibre_g": 2}]}';
globalThis.fetch = (async (input: string, init?: RequestInit) => {
  const url = String(input), body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, body });
  if (url.includes('api.openai.com')) return Response.json({ choices: [{ message: { content: estimate } }] });
  if (url.endsWith('/getFile')) return Response.json({ ok: true, result: { file_path: 'photos/p.jpg' } });
  if (url.includes('/file/bot')) return new Response(new Uint8Array([1, 2, 3]));
  return Response.json({ ok: true, result: { message_id: 55 } });
}) as typeof fetch;

async function telegram(chatId: number, text: string, secret = 'hook-secret', extra: Record<string, unknown> = {}, update?: unknown) {
  const pending: Promise<unknown>[] = [];
  const response = await app.request('/api/telegram/webhook', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify(update ?? { message: { chat: { id: chatId }, text, ...extra } }) }, env as never,
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
  assert.deepEqual(parseEstimate('ok {"is_food": true, "items": [{"name": "salad", "kcal": 580.4, "protein_g": 30, "carbs_g": 20.25, "fat_g": 42, "saturated_g": 12, "fibre_g": 5, "sugar_g": 4}, {"name": "coke", "kcal": 140, "carbs_g": 35, "sugar_g": "lots"}]} done'),
    { title: 'salad, coke', emoji: '🍽', items: [{ name: 'salad', kcal: 580 }, { name: 'coke', kcal: 140 }], totalKcal: 720,
      nutrients: { protein: 30, carbs: 55.3, fat: 42, saturated: 12, fibre: 5, sugar: 4 } }, 'missing or malformed grams count as zero');
  assert.equal(parseEstimate('{"is_food": false, "items": []}'), null);
  assert.equal(parseEstimate('no json here'), null);
});

const meals = () => db.sqlite.prepare("SELECT id, description, kcal, protein_g AS p, fat_g AS f, telegram_message_id AS mid FROM meals WHERE user_id = 'm' ORDER BY created_at").all().map(row => ({ ...row })) as any[];
const press = (data: string, messageId = 55) => telegram(7, '', 'hook-secret', {}, { callback_query: { id: 'cb', data, message: { message_id: messageId, chat: { id: 7 } } } });

test('meals log from text and photos as a formatted estimate with buttons', async () => {
  db.sqlite.exec("DELETE FROM telegram_links; DELETE FROM meals; DELETE FROM weight_phases; DELETE FROM weight_entries;");
  db.sqlite.exec("INSERT INTO telegram_links (user_id, chat_id, time_zone, remind_hour) VALUES ('m', '7', 'Europe/Madrid', 8)");
  db.sqlite.exec(`INSERT INTO weight_phases (user_id, start_date, maintenance_kcal, intake_kcal) VALUES ('m', '2000-01-01', 2300, 1800)`);
  db.sqlite.exec(`INSERT INTO weight_entries (user_id, date, weight_kg) VALUES ('m', '${mealDate('Europe/Madrid')}', 80)`);
  calls.length = 0;
  assert.equal((await telegram(7, '2 eggs & toast')).body!.action, 'typing');
  const sent = calls.at(-1)!.body;
  assert.equal(sent.parse_mode, 'HTML');
  assert.equal(sent.text, ['🍳 <b>Eggs &amp; toast</b>', '<b>≈ 270 kcal</b>', '',
    '🥩 <b>15g</b> protein  ·  🍚 <b>16g</b> carbs  ·  🧈 <b>12g</b> fat', '<i>sat. fat 0g · fibre 2g · sugar 0g</i>', '',
    '• eggs — 180', '• toast — 90', '', '<b>Today</b>', 'Kcal ▰▰▱▱▱▱▱▱▱▱ 270 / 1800', 'Protein ▰▱▱▱▱▱▱▱▱▱ 15 / 144g'].join('\n'));
  const [meal] = meals();
  assert.deepEqual(sent.reply_markup.inline_keyboard[0].map((button: any) => button.callback_data), [`fix:${meal.id}`, `undo:${meal.id}`]);
  assert.deepEqual({ ...meal, id: undefined }, { id: undefined, description: 'Eggs & toast', kcal: 270, p: 15, f: 12, mid: 55 });

  calls.length = 0;
  await telegram(7, '', 'hook-secret', { photo: [{ file_id: 'small' }, { file_id: 'big' }] });
  assert.equal(calls[0].body.file_id, 'big');
  const sentToModel = JSON.stringify(calls.find(call => call.url.includes('api.openai.com'))!.body);
  assert.ok(sentToModel.includes('data:image/jpeg;base64,AQID'), 'the photo travels as data');
  assert.ok(!sentToModel.includes('bot-token'), 'the bot token never reaches the estimator');
  assert.equal(meals().length, 2);

  estimate = '{"is_food": false, "items": []}';
  await telegram(7, 'what is the weather');
  assert.match(calls.at(-1)!.body.text, /doesn’t look like food/);
  estimate = '{"is_food": true, "title": "Eggs & toast", "emoji": "🍳", "items": [{"name": "eggs", "kcal": 180, "protein_g": 12, "fat_g": 12}, {"name": "toast", "kcal": 90, "protein_g": 3, "carbs_g": 16, "fibre_g": 2}]}';
});

test('meal buttons fix and undo only the linked user\'s meals', async () => {
  const [meal] = meals();
  assert.equal((await press(`fix:${meal.id}`)).body!.text, 'Send the new kcal');
  assert.equal(calls.at(-1)!.body.reply_markup.force_reply, true);
  assert.equal(meals()[0].mid, 55, 'the prompt becomes the reply target');
  assert.equal((await telegram(7, '320', 'hook-secret', { reply_to_message: { message_id: 55 } })).body!.text, '✓ Updated to 320 kcal');
  assert.deepEqual([meals()[0].kcal, meals()[0].p, meals()[0].f], [320, 17.8, 14.2], 'nutrients scale with the correction');

  db.sqlite.exec("INSERT INTO meals (id, user_id, date, description, kcal, created_at) VALUES ('other', 'someone-else', '2026-10-18', 'x', 1, '')");
  assert.equal((await press('undo:other')).body!.text, 'That meal is already gone.');
  assert.equal((await press(`undo:${meal.id}`)).body!.text, 'Removed');
  assert.match(calls.at(-1)!.body.text, /^↩️ <s>Eggs &amp; toast · 320 kcal<\/s>/);
  assert.equal(meals().length, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM meals WHERE id = 'other'").get()!.n, 1);
});

test('food days roll over at 02:00 local time', () => {
  assert.equal(mealDate('Europe/Madrid', new Date('2026-10-18T23:30:00Z')), '2026-10-18', '01:30 counts towards the evening before');
  assert.equal(mealDate('Europe/Madrid', new Date('2026-10-19T00:30:00Z')), '2026-10-19', '02:30 starts the new day');
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

test('meal estimates are capped per user per day, with database overrides', async () => {
  db.sqlite.exec("DELETE FROM telegram_links; DELETE FROM meals; DELETE FROM meal_estimate_usage; DELETE FROM meal_estimate_limits;");
  db.sqlite.exec("INSERT INTO telegram_links (user_id, chat_id, time_zone, remind_hour) VALUES ('capped', '8', 'Europe/Madrid', 8), ('vip', '9', 'Europe/Madrid', 8)");
  db.sqlite.exec("INSERT INTO meal_estimate_limits (user_id, per_day) VALUES ('vip', 7)");
  const modelCalls = () => calls.filter(call => call.url.includes('api.openai.com')).length;
  calls.length = 0;
  for (let i = 0; i < 6; i++) await telegram(8, `meal ${i}`);
  assert.equal(modelCalls(), 5, 'the default allows 5 a day');
  assert.equal(calls.at(-1)!.body.text, 'You’ve used today’s 5 meal estimates. More tomorrow.');
  calls.length = 0;
  for (let i = 0; i < 8; i++) await telegram(9, `meal ${i}`);
  assert.equal(modelCalls(), 7, 'a row in meal_estimate_limits overrides the default');

  const response = await api('capped', 'POST', '/../meals', { text: 'toast', date: '2026-10-18' });
  assert.equal(response.status, 429, 'the web card shares the same allowance');
});
