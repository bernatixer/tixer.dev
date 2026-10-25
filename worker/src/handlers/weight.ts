import type { Context } from "hono";
import type { Env, Variables } from "../types";
import { isDate, mealDate, validTimeZone } from "./food-days";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

async function body(c: Ctx): Promise<Record<string, unknown> | null> {
  try {
    const value = await c.req.json();
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export function saveWeight(db: D1Database, userId: string, date: string, weightKg: number) {
  return db.prepare(
    "INSERT INTO weight_entries (user_id, date, weight_kg) VALUES (?, ?, ?) ON CONFLICT (user_id, date) DO UPDATE SET weight_kg = excluded.weight_kg",
  ).bind(userId, date, weightKg).run();
}

export async function getWeight(c: Ctx) {
  const userId = c.get("userId");
  // History uses all-date summaries; descriptions are loaded only for recent days or an open drawer.
  const since = new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10);
  const [entries, phases, meals, profile, goals, days] = await Promise.all([
    c.env.DB.prepare("SELECT date, weight_kg AS weightKg FROM weight_entries WHERE user_id = ? ORDER BY date")
      .bind(userId).all(),
    c.env.DB.prepare(
      "SELECT start_date AS startDate, maintenance_kcal AS maintenanceKcal, intake_kcal AS intakeKcal, protein_g_per_kg AS proteinPerKg FROM weight_phases WHERE user_id = ? ORDER BY start_date",
    ).bind(userId).all(),
    c.env.DB.prepare("SELECT id, date, description, kcal, protein_g AS proteinG, carbs_g AS carbsG, fat_g AS fatG, saturated_g AS saturatedG, fibre_g AS fibreG, sugar_g AS sugarG, created_at AS createdAt FROM meals WHERE user_id = ? AND date >= ? ORDER BY date, created_at")
      .bind(userId, since).all(),
    c.env.DB.prepare("SELECT age, height_cm AS heightCm, sex, activity_factor AS activityFactor FROM weight_profiles WHERE user_id = ?").bind(userId).first(),
    c.env.DB.prepare("SELECT start_date AS startDate, start_weight_kg AS startWeightKg, target_date AS targetDate, target_weight_kg AS targetWeightKg FROM weight_goals WHERE user_id = ? ORDER BY start_date").bind(userId).all(),
    foodDays(c.env.DB, userId),
  ]);
  return c.json({ entries: entries.results, phases: phases.results, meals: meals.results, profile, goals: goals.results, days });
}

async function foodDays(db: D1Database, userId: string) {
  const result = await db.prepare(`
    WITH dates AS (
      SELECT date FROM weight_entries WHERE user_id = ?1
      UNION SELECT date FROM meals WHERE user_id = ?1
      UNION SELECT date FROM food_day_reviews WHERE user_id = ?1
    ), totals AS (
      SELECT date, SUM(kcal) AS kcal, COUNT(*) AS mealCount FROM meals WHERE user_id = ?1 GROUP BY date
    )
    SELECT dates.date, CASE WHEN totals.mealCount > 0 THEN totals.kcal
      WHEN reviews.confirmed_revision = reviews.revision THEN 0 ELSE NULL END AS kcal,
      COALESCE(totals.mealCount, 0) AS mealCount, COALESCE(reviews.revision, 0) AS revision,
      reviews.confirmed_revision AS confirmedRevision
    FROM dates LEFT JOIN totals ON totals.date = dates.date
    LEFT JOIN food_day_reviews reviews ON reviews.user_id = ?1 AND reviews.date = dates.date ORDER BY dates.date
  `).bind(userId).all();
  return result.results;
}

export async function getWeightDay(c: Ctx) {
  const date = c.req.param("date") ?? "";
  if (!isDate(date)) return c.json({ error: "Invalid date" }, 400);
  const userId = c.get("userId");
  // One statement keeps meals and the reviewed revision on the same database snapshot.
  const { results } = await c.env.DB.prepare(`
    SELECT meals.id, meals.date, description, kcal, protein_g AS proteinG, carbs_g AS carbsG, fat_g AS fatG,
      saturated_g AS saturatedG, fibre_g AS fibreG, sugar_g AS sugarG, created_at AS createdAt,
      COALESCE(reviews.revision, 0) AS revision, reviews.confirmed_revision AS confirmedRevision
    FROM (SELECT ?1 AS user_id, ?2 AS date) day
    LEFT JOIN meals ON meals.user_id = day.user_id AND meals.date = day.date
    LEFT JOIN food_day_reviews reviews ON reviews.user_id = day.user_id AND reviews.date = day.date
    ORDER BY created_at, meals.id
  `).bind(userId, date).all<{ id: string | null; revision: number; confirmedRevision: number | null; [key: string]: unknown }>();
  const { revision, confirmedRevision } = results[0];
  const meals = results.filter(row => row.id !== null).map(({ revision: _revision, confirmedRevision: _confirmed, ...meal }) => meal);
  return c.json({ date, meals, revision, confirmedRevision });
}

export async function putWeightProfile(c: Ctx) {
  const input = await body(c);
  if (!inRange(input?.age, 1, 120) || !Number.isInteger(input.age) || !inRange(input?.heightCm, 50, 250)
    || (input?.sex !== "male" && input?.sex !== "female") || !inRange(input?.activityFactor, 1, 3)) return c.json({ error: "Invalid profile" }, 400);
  const profile = { age: input.age, heightCm: input.heightCm, sex: input.sex, activityFactor: input.activityFactor };
  await c.env.DB.prepare("INSERT INTO weight_profiles (user_id, age, height_cm, sex, activity_factor) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET age = excluded.age, height_cm = excluded.height_cm, sex = excluded.sex, activity_factor = excluded.activity_factor")
    .bind(c.get("userId"), profile.age, profile.heightCm, profile.sex, profile.activityFactor).run();
  return c.json(profile);
}

export async function putWeightGoal(c: Ctx) {
  const startDate = c.req.param("date") ?? "";
  const input = await body(c);
  const targetDate = typeof input?.targetDate === "string" ? input.targetDate : "";
  if (!isDate(startDate) || !isDate(targetDate) || targetDate <= startDate || !inRange(input?.targetWeightKg, 20, 400)) return c.json({ error: "Invalid goal" }, 400);
  const weekAgo = new Date(Date.parse(`${startDate}T00:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10);
  // boffin: kept saved baselines fixed when corrected weigh-ins change the actual trend.
  const result = await c.env.DB.prepare(`
    INSERT INTO weight_goals (user_id, start_date, start_weight_kg, target_date, target_weight_kg)
    SELECT ?1, ?2, baseline.kg, ?3, ?4 FROM (
      SELECT COALESCE(
        (SELECT start_weight_kg FROM weight_goals WHERE user_id = ?1 AND start_date = ?2),
        (SELECT AVG(weight_kg) FROM weight_entries WHERE user_id = ?1 AND date BETWEEN ?5 AND ?2),
        (SELECT weight_kg FROM weight_entries WHERE user_id = ?1 AND date <= ?2 ORDER BY date DESC LIMIT 1)
      ) AS kg
    ) baseline WHERE baseline.kg IS NOT NULL AND ?4 < baseline.kg
    ON CONFLICT (user_id, start_date) DO UPDATE SET target_date = excluded.target_date, target_weight_kg = excluded.target_weight_kg
  `).bind(c.get("userId"), startDate, targetDate, input.targetWeightKg, weekAgo).run();
  if (!result.meta.changes) return c.json({ error: "A goal needs a weigh-in and a target below its starting average" }, 400);
  const goal = await c.env.DB.prepare("SELECT start_date AS startDate, start_weight_kg AS startWeightKg, target_date AS targetDate, target_weight_kg AS targetWeightKg FROM weight_goals WHERE user_id = ? AND start_date = ?")
    .bind(c.get("userId"), startDate).first();
  return c.json(goal);
}

export async function putDayReviews(c: Ctx) {
  const input = await body(c);
  const days = input?.days;
  const timeZone = input?.timeZone ?? "UTC";
  if (!Array.isArray(days) || !days.length || days.length > 3660 || typeof input?.complete !== "boolean" || !validTimeZone(timeZone)) return c.json({ error: "Invalid review" }, 400);
  const today = mealDate(timeZone);
  if (days.some(day => !day || typeof day.date !== "string" || !isDate(day.date) || (input.complete && day.date >= today)
    || !Number.isSafeInteger(day.revision) || day.revision < 0) || new Set(days.map(day => day.date)).size !== days.length) return c.json({ error: "Invalid review" }, 400);
  // boffin: refused the whole review range if any meal revision changed since it was displayed.
  const result = await c.env.DB.prepare(`
    WITH requested AS (SELECT json_extract(value, '$.date') AS date, json_extract(value, '$.revision') AS revision FROM json_each(?2))
    INSERT INTO food_day_reviews (user_id, date, revision, confirmed_revision)
    SELECT ?1, requested.date, requested.revision, CASE WHEN ?3 THEN requested.revision ELSE NULL END
    FROM requested WHERE NOT EXISTS (
      SELECT 1 FROM requested expected LEFT JOIN food_day_reviews current ON current.user_id = ?1 AND current.date = expected.date
      WHERE expected.revision <> COALESCE(current.revision, 0)
    )
    ON CONFLICT (user_id, date) DO UPDATE SET confirmed_revision = excluded.confirmed_revision
  `).bind(c.get("userId"), JSON.stringify(days.map(day => ({ date: day.date, revision: day.revision }))), Number(input.complete)).run();
  if (result.meta.changes !== days.length) return c.json({ error: "Food changed; review the latest totals" }, 409);
  return c.json({ days: await foodDays(c.env.DB, c.get("userId")) });
}

export async function putWeightEntry(c: Ctx) {
  const date = c.req.param("date") ?? "";
  const input = await body(c);
  if (!isDate(date) || !inRange(input?.weightKg, 20, 400)) return c.json({ error: "Invalid entry" }, 400);
  await saveWeight(c.env.DB, c.get("userId"), date, input.weightKg);
  return c.json({ date, weightKg: input.weightKg });
}

export async function deleteWeightEntry(c: Ctx) {
  await c.env.DB.prepare("DELETE FROM weight_entries WHERE user_id = ? AND date = ?")
    .bind(c.get("userId"), c.req.param("date")).run();
  return c.body(null, 204);
}

export async function putWeightPhase(c: Ctx) {
  const startDate = c.req.param("date") ?? "";
  const input = await body(c);
  const maintenanceKcal = input?.maintenanceKcal, intakeKcal = input?.intakeKcal, proteinPerKg = input?.proteinPerKg ?? null;
  if (!isDate(startDate) || !inRange(maintenanceKcal, 500, 10000) || !inRange(intakeKcal, 0, 10000)
    || !Number.isInteger(maintenanceKcal) || !Number.isInteger(intakeKcal)
    || (proteinPerKg !== null && !inRange(proteinPerKg, 0.5, 4))) return c.json({ error: "Invalid phase" }, 400);
  await c.env.DB.prepare(
    "INSERT INTO weight_phases (user_id, start_date, maintenance_kcal, intake_kcal, protein_g_per_kg) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, start_date) DO UPDATE SET maintenance_kcal = excluded.maintenance_kcal, intake_kcal = excluded.intake_kcal, protein_g_per_kg = excluded.protein_g_per_kg",
  ).bind(c.get("userId"), startDate, maintenanceKcal, intakeKcal, proteinPerKg).run();
  return c.json({ startDate, maintenanceKcal, intakeKcal, proteinPerKg });
}

export async function deleteWeightPhase(c: Ctx) {
  await c.env.DB.prepare("DELETE FROM weight_phases WHERE user_id = ? AND start_date = ?")
    .bind(c.get("userId"), c.req.param("date")).run();
  return c.body(null, 204);
}
