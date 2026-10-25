import type { Context } from "hono";
import { captureAIGeneration } from "../ai-observability";
import type { Env, Variables } from "../types";
import { isDate } from "./food-days";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MEAL_MODEL = "gpt-5.5";

const SYSTEM_PROMPT =
  "You estimate calories and nutrients in meals for a food log.\n" +
  "Given a description and/or a photo, list each food with a realistic portion-based estimate of kcal and grams of protein, carbohydrate, fat, saturated fat, fibre and sugar.\n" +
  "Use amounts the user states; otherwise assume a typical adult portion and count cooking oil, sauces and drinks you can see or that are mentioned.\n" +
  "If the input is not food or drink, return is_food false.\n" +
  "Also give the whole meal a short title (2-5 words) and one food emoji that fits it.\n" +
  "Return ONLY a JSON object: {\"is_food\": boolean, \"title\": string, \"emoji\": string, \"items\": [{\"name\": string, \"kcal\": integer, \"protein_g\": number, \"carbs_g\": number, \"fat_g\": number, \"saturated_g\": number, \"fibre_g\": number, \"sugar_g\": number}]}. Names are short and in the language given.";

export const NUTRIENTS = ["protein", "carbs", "fat", "saturated", "fibre", "sugar"] as const;
export type Nutrients = Record<(typeof NUTRIENTS)[number], number>;
export interface MealEstimate { title: string; emoji: string; items: { name: string; kcal: number }[]; totalKcal: number; nutrients: Nutrients }

const grams = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0);

// Tolerates prose around the JSON, so take the outermost object.
export function parseEstimate(content: string): MealEstimate | null {
  const json = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  let parsed: { is_food?: unknown; title?: unknown; emoji?: unknown; items?: unknown };
  try { parsed = JSON.parse(json); } catch { return null; }
  if (parsed.is_food !== true || !Array.isArray(parsed.items)) return null;
  const valid = parsed.items
    .filter((item): item is Record<string, unknown> & { name: string; kcal: number } => typeof item?.name === "string" && Number.isFinite(item?.kcal) && item.kcal >= 0);
  const items = valid.map(item => ({ name: item.name.slice(0, 80), kcal: Math.round(item.kcal) }));
  const totalKcal = items.reduce((sum, item) => sum + item.kcal, 0);
  const nutrients = Object.fromEntries(NUTRIENTS.map(name =>
    [name, Math.round(valid.reduce((sum, item) => sum + grams(item[`${name}_g`]), 0) * 10) / 10])) as Nutrients;
  const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 60) : items.map(item => item.name).join(", ");
  const emoji = typeof parsed.emoji === "string" && parsed.emoji.trim() && [...parsed.emoji.trim()].length <= 4 ? parsed.emoji.trim() : "🍽";
  return items.length && totalKcal <= 10000 ? { title, emoji, items, totalKcal, nutrients } : null;
}

function languageName(tag: string) {
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ?? "English"; } catch { return "English"; }
}

// `language` is a BCP 47 tag from the browser or Telegram; a photo alone gives the model nothing to go on.
export async function estimateMeal(env: Env, text: string, image?: string, language = "en", distinctId?: string): Promise<MealEstimate | null> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const traceId = crypto.randomUUID();
  const startedAt = Date.now();
  const content: unknown[] = [];
  if (image) content.push({ type: "image_url", image_url: { url: image } });
  content.push({ type: "text", text: text || "Estimate this meal." });
  const messages = [{ role: "system", content: `${SYSTEM_PROMPT}\nWrite every item name in ${languageName(language)}.` }, { role: "user", content }];
  let status: number | undefined;

  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MEAL_MODEL, reasoning_effort: "low", response_format: { type: "json_object" },
        messages,
      }),
    });
    status = response.status;
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}: ${await response.text().catch(() => "")}`);
    const body = await response.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const output = body.choices?.[0]?.message?.content ?? "";
    captureAIGeneration(env, {
      distinctId,
      provider: "openai",
      model: MEAL_MODEL,
      traceId,
      input: messages,
      output,
      inputTokens: body.usage?.prompt_tokens,
      outputTokens: body.usage?.completion_tokens,
      latencyMs: Date.now() - startedAt,
      httpStatus: status,
    });
    return parseEstimate(output);
  } catch (error) {
    captureAIGeneration(env, {
      distinctId,
      provider: "openai",
      model: MEAL_MODEL,
      traceId,
      input: messages,
      latencyMs: Date.now() - startedAt,
      httpStatus: status,
      error,
    });
    throw error;
  }
}

export const describe = (estimate: MealEstimate) => estimate.title;

export const DEFAULT_ESTIMATES_PER_DAY = 5;

// Claims one estimate before the model is called, so a user over the cap never costs anything.
export async function claimEstimate(db: D1Database, userId: string, now = new Date()): Promise<{ allowed: boolean; limit: number }> {
  const date = now.toISOString().slice(0, 10);
  const row = await db.prepare("SELECT per_day FROM meal_estimate_limits WHERE user_id = ?").bind(userId).first<{ per_day: number }>();
  const limit = row?.per_day ?? DEFAULT_ESTIMATES_PER_DAY;
  const used = await db.prepare(
    "INSERT INTO meal_estimate_usage (user_id, date, count) VALUES (?, ?, 1) ON CONFLICT (user_id, date) DO UPDATE SET count = count + 1 RETURNING count",
  ).bind(userId, date).first<{ count: number }>();
  return { allowed: (used?.count ?? 1) <= limit, limit };
}

export const limitMessage = (limit: number) => `You’ve used today’s ${limit} meal estimates. More tomorrow.`;

export async function addMeal(db: D1Database, userId: string, date: string, description: string, estimate: Pick<MealEstimate, "totalKcal"> & { nutrients?: Nutrients }, telegramMessageId: number | null = null) {
  const protein = estimate.nutrients?.protein ?? null, carbs = estimate.nutrients?.carbs ?? null, fat = estimate.nutrients?.fat ?? null;
  const saturated = estimate.nutrients?.saturated ?? null, fibre = estimate.nutrients?.fibre ?? null, sugar = estimate.nutrients?.sugar ?? null;
  const meal = { id: crypto.randomUUID(), date, description, kcal: estimate.totalKcal, proteinG: protein, carbsG: carbs, fatG: fat, saturatedG: saturated, fibreG: fibre, sugarG: sugar, createdAt: new Date().toISOString() };
  await db.prepare("INSERT INTO meals (id, user_id, date, description, kcal, protein_g, carbs_g, fat_g, saturated_g, fibre_g, sugar_g, telegram_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(meal.id, userId, date, description, meal.kcal, protein, carbs, fat, saturated, fibre, sugar, telegramMessageId, meal.createdAt).run();
  return meal;
}

// A corrected kcal scales the nutrients by the same ratio; SQLite evaluates the right-hand sides against the old row.
export async function correctMealKcal(db: D1Database, kcal: number, where: string, ...params: unknown[]) {
  const scaled = NUTRIENTS.map(name => `${name}_g = CASE WHEN kcal > 0 THEN ROUND(${name}_g * ?1 / kcal, 1) ELSE ${name}_g END`).join(", ");
  return db.prepare(`UPDATE meals SET ${scaled}, kcal = ?1 WHERE ${where}`).bind(kcal, ...params).run();
}

export async function removeMeal(db: D1Database, userId: string, mealId: string) {
  await db.prepare("DELETE FROM meals WHERE id = ? AND user_id = ?").bind(mealId, userId).run();
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const bar = (value: number, target: number) => { const filled = Math.round(Math.min(1, value / target) * 10); return "▰".repeat(filled) + "▱".repeat(10 - filled); };

export interface DayProgress { kcal: number; kcalTarget: number | null; protein: number; proteinTarget: number | null }

// Telegram HTML: a plain list rather than <pre>, which would add a copy button.
export function mealMessage(estimate: MealEstimate, today: DayProgress) {
  const { protein, carbs, fat, saturated, fibre, sugar } = estimate.nutrients;
  const lines = [
    `${estimate.emoji} <b>${escapeHtml(estimate.title)}</b>`,
    `<b>≈ ${estimate.totalKcal} kcal</b>`,
    "",
    `🥩 <b>${Math.round(protein)}g</b> protein  ·  🍚 <b>${Math.round(carbs)}g</b> carbs  ·  🧈 <b>${Math.round(fat)}g</b> fat`,
    `<i>sat. fat ${Math.round(saturated)}g · fibre ${Math.round(fibre)}g · sugar ${Math.round(sugar)}g</i>`,
    "",
    ...estimate.items.map(item => `• ${escapeHtml(item.name)} — ${item.kcal}`),
  ];
  if (today.kcalTarget || today.proteinTarget) {
    lines.push("", "<b>Today</b>");
    if (today.kcalTarget) lines.push(`Kcal ${bar(today.kcal, today.kcalTarget)} ${today.kcal} / ${today.kcalTarget}`);
    if (today.proteinTarget) lines.push(`Protein ${bar(today.protein, today.proteinTarget)} ${Math.round(today.protein)} / ${today.proteinTarget}g`);
  }
  return lines.join("\n");
}

const PROTEIN_PER_KG = 1.5;

// Mirrors the Food card: planned intake from the active phase, protein as g/kg × the 7-day average weight.
export async function dayProgress(db: D1Database, userId: string, date: string): Promise<DayProgress> {
  const weekAgo = new Date(Date.parse(`${date}T00:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10);
  const [eaten, phase, weight] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(kcal), 0) AS kcal, COALESCE(SUM(protein_g), 0) AS protein FROM meals WHERE user_id = ? AND date = ?").bind(userId, date).first<{ kcal: number; protein: number }>(),
    db.prepare("SELECT intake_kcal FROM weight_phases WHERE user_id = ? AND start_date <= ? ORDER BY start_date DESC LIMIT 1").bind(userId, date).first<{ intake_kcal: number }>(),
    db.prepare("SELECT AVG(weight_kg) AS kg FROM weight_entries WHERE user_id = ? AND date BETWEEN ? AND ?").bind(userId, weekAgo, date).first<{ kg: number | null }>(),
  ]);
  return {
    kcal: eaten?.kcal ?? 0, protein: eaten?.protein ?? 0,
    kcalTarget: phase?.intake_kcal ?? null,
    proteinTarget: weight?.kg ? Math.round(PROTEIN_PER_KG * weight.kg) : null,
  };
}

export const mealButtons = (mealId: string) => ({ inline_keyboard: [
  [{ text: "✏️ Fix kcal", callback_data: `fix:${mealId}` }, { text: "↩️ Undo", callback_data: `undo:${mealId}` }],
] });


const validKcal = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10000;

export async function postMeal(c: Ctx) {
  const input = await c.req.json<Record<string, unknown>>().catch(() => null);
  const text = typeof input?.text === "string" ? input.text.trim().slice(0, 500) : "";
  const date = typeof input?.date === "string" ? input.date : "";
  if (input?.kcal !== undefined || input?.description !== undefined) {
    const description = typeof input.description === "string" ? input.description.trim() : "";
    if (!description || description.length > 500 || !validKcal(input.kcal) || !isDate(date)) return c.json({ error: "Invalid meal" }, 400);
    return c.json(await addMeal(c.env.DB, c.get("userId"), date, description, { totalKcal: input.kcal }));
  }
  // Browsers downscale before upload; the cap only stops oversized payloads reaching the model.
  const image = typeof input?.image === "string" && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image) && input.image.length <= 3_000_000 ? input.image : undefined;
  if ((!text && !image) || (input?.image !== undefined && !image) || !isDate(date)) return c.json({ error: "Invalid meal" }, 400);
  const language = typeof input?.language === "string" && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.language) ? input.language : undefined;
  const claim = await claimEstimate(c.env.DB, c.get("userId"));
  if (!claim.allowed) return c.json({ error: limitMessage(claim.limit) }, 429);
  const estimate = await estimateMeal(c.env, text, image, language, c.get("userId")).catch(() => undefined);
  if (estimate === undefined) return c.json({ error: "Estimator unavailable" }, 502);
  if (!estimate) return c.json({ error: "That doesn't look like food" }, 422);
  return c.json(await addMeal(c.env.DB, c.get("userId"), date, describe(estimate), estimate));
}

export async function putMeal(c: Ctx) {
  const input = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!validKcal(input?.kcal)) return c.json({ error: "Invalid kcal" }, 400);
  const result = await correctMealKcal(c.env.DB, input.kcal, "id = ?2 AND user_id = ?3", c.req.param("id") ?? "", c.get("userId"));
  return result.meta.changes ? c.json({ kcal: input.kcal }) : c.json({ error: "Not found" }, 404);
}

export async function deleteMeal(c: Ctx) {
  await removeMeal(c.env.DB, c.get("userId"), c.req.param("id") ?? "");
  return c.body(null, 204);
}
