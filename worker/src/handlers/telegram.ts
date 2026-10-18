import type { Context } from "hono";
import type { Env, Variables } from "../types";
import { saveWeight } from "./weight";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 15 * 60 * 1000;

export function localNow(timeZone: string, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

const validTimeZone = (value: unknown): value is string => {
  if (typeof value !== "string" || !value) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
};
const validHour = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 23;

// "80.6", "80,6" or "80.6 kg"; anything else is not a weigh-in.
export function parseWeight(text: string): number | null {
  const match = text.trim().match(/^(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg)?$/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return value >= 20 && value <= 400 ? value : null;
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

// Replies ride on the webhook response, so the bot never needs an outbound call to answer.
const reply = (c: Ctx, chatId: number | string, text: string) => c.json({ method: "sendMessage", chat_id: chatId, text });

export async function telegramWebhook(c: Ctx) {
  const secret = c.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || c.req.header("x-telegram-bot-api-secret-token") !== secret) return c.json({ error: "Forbidden" }, 403);
  const update = await c.req.json<{ message?: { chat?: { id?: number }; text?: string } }>().catch(() => null);
  const chatId = update?.message?.chat?.id, text = update?.message?.text?.trim() ?? "";
  if (chatId === undefined) return c.body(null, 200);

  const link = await c.env.DB.prepare("SELECT user_id, time_zone FROM telegram_links WHERE chat_id = ?")
    .bind(String(chatId)).first<{ user_id: string; time_zone: string }>();
  if (!link || text.startsWith("/start")) {
    const code = newCode();
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM telegram_codes WHERE chat_id = ? OR expires_at < ?").bind(String(chatId), new Date().toISOString()),
      c.env.DB.prepare("INSERT INTO telegram_codes (code, chat_id, expires_at) VALUES (?, ?, ?)")
        .bind(code, String(chatId), new Date(Date.now() + CODE_TTL_MS).toISOString()),
    ]);
    return reply(c, chatId, `Your code is ${code}\n\nEnter it in Focus → Weight → Telegram to get daily weigh-in reminders here. It expires in 15 minutes.`);
  }

  const weightKg = parseWeight(text);
  if (weightKg === null) return reply(c, chatId, "Just send your weight, e.g. 80.6");
  await saveWeight(c.env.DB, link.user_id, localNow(link.time_zone).date, weightKg);
  return reply(c, chatId, `✓ ${weightKg.toFixed(2)} kg logged`);
}

export async function getTelegram(c: Ctx) {
  const link = await c.env.DB.prepare("SELECT time_zone AS timeZone, remind_hour AS remindHour FROM telegram_links WHERE user_id = ?")
    .bind(c.get("userId")).first();
  return c.json(link ? { linked: true, ...link } : { linked: false });
}

export async function linkTelegram(c: Ctx) {
  const input = await c.req.json<Record<string, unknown>>().catch(() => null);
  const code = typeof input?.code === "string" ? input.code.trim().toUpperCase() : "";
  if (!code || !validTimeZone(input?.timeZone) || !validHour(input?.remindHour)) return c.json({ error: "Invalid request" }, 400);
  const found = await c.env.DB.prepare("SELECT chat_id FROM telegram_codes WHERE code = ? AND expires_at > ?")
    .bind(code, new Date().toISOString()).first<{ chat_id: string }>();
  if (!found) return c.json({ error: "Code not found or expired" }, 404);
  const userId = c.get("userId");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM telegram_codes WHERE chat_id = ?").bind(found.chat_id),
    c.env.DB.prepare("DELETE FROM telegram_links WHERE user_id = ? OR chat_id = ?").bind(userId, found.chat_id),
    c.env.DB.prepare("INSERT INTO telegram_links (user_id, chat_id, time_zone, remind_hour) VALUES (?, ?, ?, ?)")
      .bind(userId, found.chat_id, input!.timeZone, input!.remindHour),
  ]);
  return c.json({ linked: true, timeZone: input!.timeZone, remindHour: input!.remindHour });
}

export async function updateTelegram(c: Ctx) {
  const input = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!validTimeZone(input?.timeZone) || !validHour(input?.remindHour)) return c.json({ error: "Invalid request" }, 400);
  const result = await c.env.DB.prepare("UPDATE telegram_links SET time_zone = ?, remind_hour = ? WHERE user_id = ?")
    .bind(input!.timeZone, input!.remindHour, c.get("userId")).run();
  if (!result.meta.changes) return c.json({ error: "Not linked" }, 404);
  return c.json({ linked: true, timeZone: input!.timeZone, remindHour: input!.remindHour });
}

export async function unlinkTelegram(c: Ctx) {
  await c.env.DB.prepare("DELETE FROM telegram_links WHERE user_id = ?").bind(c.get("userId")).run();
  return c.body(null, 204);
}

// Runs hourly; each user is asked once, at their hour, only if today is still empty.
export async function sendReminders(env: Env, now = new Date(), send = fetch) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const { results } = await env.DB.prepare("SELECT user_id, chat_id, time_zone, remind_hour, last_reminded FROM telegram_links").all<{
    user_id: string; chat_id: string; time_zone: string; remind_hour: number; last_reminded: string | null;
  }>();
  for (const link of results) {
    const local = localNow(link.time_zone, now);
    if (local.hour !== link.remind_hour || link.last_reminded === local.date) continue;
    const logged = await env.DB.prepare("SELECT 1 FROM weight_entries WHERE user_id = ? AND date = ?").bind(link.user_id, local.date).first();
    await env.DB.prepare("UPDATE telegram_links SET last_reminded = ? WHERE user_id = ?").bind(local.date, link.user_id).run();
    if (logged) continue;
    await send(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: link.chat_id, text: "⚖️ Morning! What do you weigh today?" }),
    }).catch(() => undefined);
  }
}
