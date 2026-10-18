import type { Context } from "hono";
import type { Env, Variables } from "../types";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MEAL_MODEL = "gpt-5.4-mini";

const SYSTEM_PROMPT =
  "You estimate calories in meals for a food log.\n" +
  "Given a description and/or a photo, list each food with a realistic portion-based kcal estimate.\n" +
  "Use amounts the user states; otherwise assume a typical adult portion and count cooking oil, sauces and drinks you can see or that are mentioned.\n" +
  "If the input is not food or drink, return is_food false.\n" +
  "Return ONLY a JSON object: {\"is_food\": boolean, \"items\": [{\"name\": string, \"kcal\": integer}]}. Names are short, in the user's language.";

export interface MealEstimate { items: { name: string; kcal: number }[]; totalKcal: number }

// Tolerates prose around the JSON, so take the outermost object.
export function parseEstimate(content: string): MealEstimate | null {
  const json = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  let parsed: { is_food?: unknown; items?: unknown };
  try { parsed = JSON.parse(json); } catch { return null; }
  if (parsed.is_food !== true || !Array.isArray(parsed.items)) return null;
  const items = parsed.items
    .filter((item): item is { name: string; kcal: number } => typeof item?.name === "string" && Number.isFinite(item?.kcal) && item.kcal >= 0)
    .map(item => ({ name: item.name.slice(0, 80), kcal: Math.round(item.kcal) }));
  const totalKcal = items.reduce((sum, item) => sum + item.kcal, 0);
  return items.length && totalKcal <= 10000 ? { items, totalKcal } : null;
}

export async function estimateMeal(env: Env, text: string, image?: string): Promise<MealEstimate | null> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const content: unknown[] = [];
  if (image) content.push({ type: "image_url", image_url: { url: image } });
  content.push({ type: "text", text: text || "Estimate this meal." });
  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MEAL_MODEL, reasoning_effort: "low", response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content }],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}: ${await response.text().catch(() => "")}`);
  const body = await response.json() as { choices?: { message?: { content?: string } }[] };
  return parseEstimate(body.choices?.[0]?.message?.content ?? "");
}

export const describe = (estimate: MealEstimate) => estimate.items.map(item => item.name).join(", ");

export async function addMeal(db: D1Database, userId: string, date: string, description: string, kcal: number, telegramMessageId: number | null = null) {
  const meal = { id: crypto.randomUUID(), date, description, kcal, createdAt: new Date().toISOString() };
  await db.prepare("INSERT INTO meals (id, user_id, date, description, kcal, telegram_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(meal.id, userId, date, description, kcal, telegramMessageId, meal.createdAt).run();
  return meal;
}

export const closeDay = (db: D1Database, userId: string, date: string) =>
  db.prepare("INSERT OR IGNORE INTO meal_days (user_id, date) VALUES (?, ?)").bind(userId, date).run();

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const validKcal = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10000;

export async function postMeal(c: Ctx) {
  const input = await c.req.json<Record<string, unknown>>().catch(() => null);
  const text = typeof input?.text === "string" ? input.text.trim().slice(0, 500) : "";
  const date = typeof input?.date === "string" ? input.date : "";
  if (!text || !isDate(date)) return c.json({ error: "Invalid meal" }, 400);
  const estimate = await estimateMeal(c.env, text).catch(() => undefined);
  if (estimate === undefined) return c.json({ error: "Estimator unavailable" }, 502);
  if (!estimate) return c.json({ error: "That doesn't look like food" }, 422);
  return c.json(await addMeal(c.env.DB, c.get("userId"), date, describe(estimate), estimate.totalKcal));
}

export async function putMeal(c: Ctx) {
  const input = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!validKcal(input?.kcal)) return c.json({ error: "Invalid kcal" }, 400);
  const result = await c.env.DB.prepare("UPDATE meals SET kcal = ? WHERE id = ? AND user_id = ?")
    .bind(input.kcal, c.req.param("id") ?? "", c.get("userId")).run();
  return result.meta.changes ? c.json({ kcal: input.kcal }) : c.json({ error: "Not found" }, 404);
}

export async function deleteMeal(c: Ctx) {
  await c.env.DB.prepare("DELETE FROM meals WHERE id = ? AND user_id = ?").bind(c.req.param("id") ?? "", c.get("userId")).run();
  return c.body(null, 204);
}

export async function putMealDay(c: Ctx) {
  const date = c.req.param("date") ?? "";
  const input = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!isDate(date) || typeof input?.closed !== "boolean") return c.json({ error: "Invalid day" }, 400);
  if (input.closed) await closeDay(c.env.DB, c.get("userId"), date);
  else await c.env.DB.prepare("DELETE FROM meal_days WHERE user_id = ? AND date = ?").bind(c.get("userId"), date).run();
  return c.json({ date, closed: input.closed });
}
