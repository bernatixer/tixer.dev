import type { Context } from "hono";
import type { Env, Variables } from "../types";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
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
  // Meals only feed the 3-week maintenance window and today's card; 35 days covers both with slack.
  const since = new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10);
  const [entries, phases, meals, closedDays] = await Promise.all([
    c.env.DB.prepare("SELECT date, weight_kg AS weightKg FROM weight_entries WHERE user_id = ? ORDER BY date")
      .bind(userId).all(),
    c.env.DB.prepare(
      "SELECT start_date AS startDate, maintenance_kcal AS maintenanceKcal, intake_kcal AS intakeKcal, protein_g_per_kg AS proteinPerKg FROM weight_phases WHERE user_id = ? ORDER BY start_date",
    ).bind(userId).all(),
    c.env.DB.prepare("SELECT id, date, description, kcal, protein_g AS proteinG, carbs_g AS carbsG, fat_g AS fatG, fibre_g AS fibreG, sugar_g AS sugarG, created_at AS createdAt FROM meals WHERE user_id = ? AND date >= ? ORDER BY date, created_at")
      .bind(userId, since).all(),
    c.env.DB.prepare("SELECT date FROM meal_days WHERE user_id = ? AND date >= ? ORDER BY date").bind(userId, since).all<{ date: string }>(),
  ]);
  return c.json({ entries: entries.results, phases: phases.results, meals: meals.results, closedDays: closedDays.results.map(row => row.date) });
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
