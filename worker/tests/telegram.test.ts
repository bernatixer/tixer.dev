import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { app } from '../src/index.ts';
import { parseWeight, sendReminders } from '../src/handlers/telegram.ts';
import { database } from './sqlite.ts';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const db = database();
after(() => db.sqlite.close());
const env = { DB: db, CLERK_PEM_PUBLIC_KEY: await exportSPKI(publicKey), ZAI_API_KEY: '', TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_WEBHOOK_SECRET: 'hook-secret' };
const token = (sub: string) => new SignJWT({ sub }).setProtectedHeader({ alg: 'RS256' }).setExpirationTime('5m').sign(privateKey);

async function telegram(chatId: number, text: string, secret = 'hook-secret') {
  const response = await app.request('/api/telegram/webhook', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify({ message: { chat: { id: chatId }, text } }) }, env as never);
  return { status: response.status, body: response.status === 200 ? await response.json() as { text: string } : null };
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

  assert.equal((await telegram(42, 'hi')).body!.text, 'Just send your weight, e.g. 80.6');
  assert.equal((await telegram(42, '80,6')).body!.text, '✓ 80.60 kg logged');
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM weight_entries WHERE user_id = 'alice' AND weight_kg = 80.6").get()!.n, 1);
  assert.match((await telegram(99, '80.6')).body!.text, /Your code is/, 'unlinked chats get a code, not a log');

  assert.equal((await api('alice', 'DELETE', '')).status, 204);
  assert.deepEqual((await api('alice', 'GET', '')).json, { linked: false });
});

test('reminders go once, at the local hour, and only when today is empty', async () => {
  db.sqlite.exec("DELETE FROM telegram_links; DELETE FROM weight_entries;");
  db.sqlite.exec("INSERT INTO telegram_links (user_id, chat_id, time_zone, remind_hour) VALUES ('a', '1', 'Europe/Madrid', 8), ('b', '2', 'Europe/Madrid', 8), ('c', '3', 'Asia/Tokyo', 8)");
  db.sqlite.exec("INSERT INTO weight_entries (user_id, date, weight_kg) VALUES ('b', '2026-10-18', 80)");
  const sent: string[] = [];
  const send = (async (_url: string, init: RequestInit) => { sent.push(JSON.parse(String(init.body)).chat_id); return new Response('{}'); }) as typeof fetch;
  const eightInMadrid = new Date('2026-10-18T06:00:00Z');
  await sendReminders(env as never, eightInMadrid, send);
  await sendReminders(env as never, eightInMadrid, send);
  assert.deepEqual(sent, ['1']);
});
