import type { Context } from "hono";
import type { Env, Variables } from "../types";
import { addMeal, closeDay, correctMealKcal, describe, estimateMeal, nutrientLine } from "./meals";
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

// Quick replies ride on the webhook response; meal estimates take seconds, so they're sent from waitUntil.
const reply = (c: Ctx, chatId: number | string, text: string) => c.json({ method: "sendMessage", chat_id: chatId, text });

export async function telegramCall<T = unknown>(env: Env, method: string, body: unknown, send: typeof fetch = fetch): Promise<T | undefined> {
  const response = await send(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const json = await response.json() as { ok?: boolean; result?: T };
  return json.ok ? json.result : undefined;
}

// The file URL embeds the bot token, so the photo goes to the estimator as data, never as a link.
async function downloadPhoto(env: Env, fileId: string): Promise<string> {
  const file = await telegramCall<{ file_path?: string }>(env, "getFile", { file_id: fileId });
  if (!file?.file_path) throw new Error("Telegram getFile failed");
  const response = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!response.ok) throw new Error(`Telegram file download returned ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

async function logMeal(env: Env, link: { user_id: string; time_zone: string }, chatId: number, text: string, photoId?: string, language?: string) {
  try {
    const estimate = await estimateMeal(env, text, photoId ? await downloadPhoto(env, photoId) : undefined, language);
    if (!estimate) {
      await telegramCall(env, "sendMessage", { chat_id: chatId, text: "That doesn’t look like food. Send a meal (text or photo), your weight, or “done” to close the day." });
      return;
    }
    const lines = estimate.items.map(item => `• ${item.name} · ${item.kcal}`).join("\n");
    const sent = await telegramCall<{ message_id: number }>(env, "sendMessage", {
      chat_id: chatId, text: `≈ ${estimate.totalKcal} kcal\n${nutrientLine(estimate.nutrients)}\n\n${lines}\n\nReply to this message with a number to correct it.`,
    });
    await addMeal(env.DB, link.user_id, localNow(link.time_zone).date, text || describe(estimate), estimate, sent?.message_id ?? null);
  } catch (error) {
    console.error("meal estimate failed", error);
    await telegramCall(env, "sendMessage", { chat_id: chatId, text: "Couldn’t estimate that right now. Try again in a minute." }).catch(() => undefined);
  }
}

interface TelegramMessage {
  chat?: { id?: number };
  text?: string;
  caption?: string;
  photo?: { file_id: string }[];
  reply_to_message?: { message_id?: number };
  from?: { language_code?: string };
}

export async function telegramWebhook(c: Ctx) {
  const secret = c.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || c.req.header("x-telegram-bot-api-secret-token") !== secret) return c.json({ error: "Forbidden" }, 403);
  const update = await c.req.json<{ message?: TelegramMessage }>().catch(() => null);
  const message = update?.message;
  const chatId = message?.chat?.id, text = (message?.text ?? message?.caption ?? "").trim();
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

  const today = localNow(link.time_zone).date;
  const photo = message?.photo?.at(-1)?.file_id;
  if (!photo && /^\/?done\.?$/i.test(text)) {
    await closeDay(c.env.DB, link.user_id, today);
    return reply(c, chatId, "✓ Day closed");
  }
  const repliedTo = message?.reply_to_message?.message_id;
  const kcal = /^\d{1,5}(?:\s*kcal)?$/i.test(text) ? parseInt(text, 10) : null;
  if (!photo && repliedTo !== undefined && kcal !== null && kcal <= 10000) {
    const result = await correctMealKcal(c.env.DB, kcal, "user_id = ?2 AND telegram_message_id = ?3", link.user_id, repliedTo);
    if (result.meta.changes) return reply(c, chatId, `✓ Updated to ${kcal} kcal`);
  }
  const weightKg = photo ? null : parseWeight(text);
  if (weightKg !== null) {
    await saveWeight(c.env.DB, link.user_id, today, weightKg);
    return reply(c, chatId, `✓ ${weightKg.toFixed(2)} kg logged`);
  }
  if (!photo && !text) return c.body(null, 200);
  c.executionCtx.waitUntil(logMeal(c.env, link, chatId, text.slice(0, 500), photo, message?.from?.language_code));
  return c.json({ method: "sendChatAction", chat_id: chatId, action: "typing" });
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

const CLOSEOUT_HOUR = 21;

// Runs hourly. At each user's hour: ask for the weight if today is empty. At 21:00: if meals were
// logged but the day is still open, ask once whether anything is missing.
export async function sendReminders(env: Env, now = new Date(), send: typeof fetch = fetch) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const { results } = await env.DB.prepare("SELECT user_id, chat_id, time_zone, remind_hour, last_reminded FROM telegram_links").all<{
    user_id: string; chat_id: string; time_zone: string; remind_hour: number; last_reminded: string | null;
  }>();
  const message = (chatId: string, text: string) => telegramCall(env, "sendMessage", { chat_id: chatId, text }, send).catch(() => undefined);
  for (const link of results) {
    const local = localNow(link.time_zone, now);
    if (local.hour === link.remind_hour && link.last_reminded !== local.date) {
      const logged = await env.DB.prepare("SELECT 1 FROM weight_entries WHERE user_id = ? AND date = ?").bind(link.user_id, local.date).first();
      await env.DB.prepare("UPDATE telegram_links SET last_reminded = ? WHERE user_id = ?").bind(local.date, link.user_id).run();
      if (!logged) await message(link.chat_id, "⚖️ Morning! What do you weigh today?");
    }
    if (local.hour === CLOSEOUT_HOUR) {
      const open = await env.DB.prepare(
        "SELECT 1 FROM meals WHERE user_id = ? AND date = ? AND NOT EXISTS (SELECT 1 FROM meal_days WHERE user_id = ? AND date = ?) LIMIT 1",
      ).bind(link.user_id, local.date, link.user_id, local.date).first();
      if (!open) continue;
      const fresh = await env.DB.prepare("INSERT OR IGNORE INTO telegram_nudges (user_id, date, kind) VALUES (?, ?, 'closeout')")
        .bind(link.user_id, local.date).run();
      if (fresh.meta.changes) await message(link.chat_id, "🍽 Anything else to log today? Send it, or reply “done” to close the day.");
    }
  }
}
