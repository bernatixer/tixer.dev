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

export async function getWeight(c: Ctx) {
  const userId = c.get("userId");
  const [entries, phases] = await Promise.all([
    c.env.DB.prepare("SELECT date, weight_kg AS weightKg FROM weight_entries WHERE user_id = ? ORDER BY date")
      .bind(userId).all(),
    c.env.DB.prepare(
      "SELECT start_date AS startDate, maintenance_kcal AS maintenanceKcal, intake_kcal AS intakeKcal FROM weight_phases WHERE user_id = ? ORDER BY start_date",
    ).bind(userId).all(),
  ]);
  return c.json({ entries: entries.results, phases: phases.results });
}

export async function putWeightEntry(c: Ctx) {
  const date = c.req.param("date") ?? "";
  const input = await body(c);
  if (!isDate(date) || !inRange(input?.weightKg, 20, 400)) return c.json({ error: "Invalid entry" }, 400);
  await c.env.DB.prepare(
    "INSERT INTO weight_entries (user_id, date, weight_kg) VALUES (?, ?, ?) ON CONFLICT (user_id, date) DO UPDATE SET weight_kg = excluded.weight_kg",
  ).bind(c.get("userId"), date, input.weightKg).run();
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
  const maintenanceKcal = input?.maintenanceKcal, intakeKcal = input?.intakeKcal;
  if (!isDate(startDate) || !inRange(maintenanceKcal, 500, 10000) || !inRange(intakeKcal, 0, 10000)
    || !Number.isInteger(maintenanceKcal) || !Number.isInteger(intakeKcal)) return c.json({ error: "Invalid phase" }, 400);
  await c.env.DB.prepare(
    "INSERT INTO weight_phases (user_id, start_date, maintenance_kcal, intake_kcal) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, start_date) DO UPDATE SET maintenance_kcal = excluded.maintenance_kcal, intake_kcal = excluded.intake_kcal",
  ).bind(c.get("userId"), startDate, maintenanceKcal, intakeKcal).run();
  return c.json({ startDate, maintenanceKcal, intakeKcal });
}

export async function deleteWeightPhase(c: Ctx) {
  await c.env.DB.prepare("DELETE FROM weight_phases WHERE user_id = ? AND start_date = ?")
    .bind(c.get("userId"), c.req.param("date")).run();
  return c.body(null, 204);
}
