import type { Context } from "hono";
import { rowToWeeklyGoal, type WeeklyGoalRow } from "../db";
import { getPostHog } from "../posthog";
import type {
  CreateWeeklyGoalRequest,
  Env,
  Variables,
  WeeklyGoal,
} from "../types";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

const SELECT_COLS =
  'SELECT id, user_id, week_start, title, target, progress, recurring, "order", created_at, completed_at FROM weekly_goals';

function dbError(c: Ctx, e: unknown) {
  return c.json({ error: `DB error: ${(e as Error).message}` }, 500);
}

// Returns the ISO date (YYYY-MM-DD) of the Monday for the week containing the
// given UTC date. Mirrors the frontend helper so the two stay in sync.
function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Materialize recurring goals from the most recent prior week into the
// requested week. Idempotent — only inserts rows that don't already exist.
async function materializeRecurringFor(
  c: Ctx,
  userId: string,
  weekStart: string,
): Promise<void> {
  const prior = await c.env.DB.prepare(
    "SELECT MAX(week_start) AS week_start FROM weekly_goals WHERE user_id = ? AND week_start < ?",
  )
    .bind(userId, weekStart)
    .first<{ week_start: string | null }>();

  if (!prior?.week_start) return;

  const { results } = await c.env.DB.prepare(
    `${SELECT_COLS} WHERE user_id = ? AND week_start = ? AND recurring = 1`,
  )
    .bind(userId, prior.week_start)
    .all<WeeklyGoalRow>();

  if (results.length === 0) return;

  for (const row of results) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    try {
      await c.env.DB.prepare(
        `INSERT INTO weekly_goals (id, user_id, week_start, title, target, progress, recurring, "order", created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, NULL)`,
      )
        .bind(id, userId, weekStart, row.title, row.target, row.order, createdAt)
        .run();
    } catch {
      // ignore — likely a race / duplicate run
    }
  }
}

export async function listWeeklyGoals(c: Ctx) {
  const userId = c.get("userId");
  const weekStart = c.req.query("week") ?? mondayOf(new Date());

  try {
    const initial = await c.env.DB.prepare(
      `${SELECT_COLS} WHERE user_id = ? AND week_start = ? ORDER BY "order", created_at`,
    )
      .bind(userId, weekStart)
      .all<WeeklyGoalRow>();

    if (initial.results.length === 0) {
      await materializeRecurringFor(c, userId, weekStart);
    }

    const { results } = await c.env.DB.prepare(
      `${SELECT_COLS} WHERE user_id = ? AND week_start = ? ORDER BY "order", created_at`,
    )
      .bind(userId, weekStart)
      .all<WeeklyGoalRow>();

    return c.json({ weekStart, goals: results.map(rowToWeeklyGoal) });
  } catch (e) {
    return dbError(c, e);
  }
}

export async function createWeeklyGoal(c: Ctx) {
  const userId = c.get("userId");
  let body: CreateWeeklyGoalRequest;
  try {
    body = await c.req.json<CreateWeeklyGoalRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const weekStart = body.weekStart ?? mondayOf(new Date());
  const target = Math.max(1, body.target ?? 1);
  const progress = Math.max(0, Math.min(target, body.progress ?? 0));
  const recurring = body.recurring ? 1 : 0;
  const order = body.order ?? 0;
  const completedAt =
    progress >= target && target > 0 ? new Date().toISOString() : null;

  try {
    await c.env.DB.prepare(
      `INSERT INTO weekly_goals (id, user_id, week_start, title, target, progress, recurring, "order", created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        userId,
        weekStart,
        body.title,
        target,
        progress,
        recurring,
        order,
        createdAt,
        completedAt,
      )
      .run();
  } catch (e) {
    return dbError(c, e);
  }

  const goal: WeeklyGoal = {
    id,
    weekStart,
    title: body.title,
    target,
    progress,
    recurring: recurring === 1,
    order,
    createdAt,
    completedAt,
  };

  const posthog = getPostHog(c.env);
  if (posthog) {
    posthog.capture({
      distinctId: userId,
      event: "weekly goal created",
      properties: {
        goal_id: id,
        week_start: weekStart,
        target,
        recurring: recurring === 1,
      },
    });
  }

  return c.json(goal, 201);
}

export async function updateWeeklyGoal(c: Ctx) {
  const userId = c.get("userId");
  const id = c.req.param("id");
  let body: WeeklyGoal;
  try {
    body = await c.req.json<WeeklyGoal>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const target = Math.max(1, body.target);
  const progress = Math.max(0, Math.min(target, body.progress));
  const wasCompleted = body.completedAt !== null;
  const completedAt =
    progress >= target && target > 0
      ? body.completedAt ?? new Date().toISOString()
      : null;
  const isNowCompleted = completedAt !== null && !wasCompleted;

  try {
    const result = await c.env.DB.prepare(
      `UPDATE weekly_goals
       SET title = ?, target = ?, progress = ?, recurring = ?, "order" = ?, completed_at = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(
        body.title,
        target,
        progress,
        body.recurring ? 1 : 0,
        body.order,
        completedAt,
        id,
        userId,
      )
      .run();
    if (!result.meta.changes) return c.json({ error: "Goal not found" }, 404);
  } catch (e) {
    return dbError(c, e);
  }

  const posthog = getPostHog(c.env);
  if (posthog && isNowCompleted) {
    posthog.capture({
      distinctId: userId,
      event: "weekly goal completed",
      properties: {
        goal_id: id,
        week_start: body.weekStart,
        target,
        progress,
      },
    });
  }

  return c.json({ ...body, target, progress, completedAt });
}

export async function deleteWeeklyGoal(c: Ctx) {
  const userId = c.get("userId");
  const id = c.req.param("id");
  try {
    const result = await c.env.DB.prepare(
      "DELETE FROM weekly_goals WHERE id = ? AND user_id = ?",
    )
      .bind(id, userId)
      .run();
    if (!result.meta.changes) return c.json({ error: "Goal not found" }, 404);

    const posthog = getPostHog(c.env);
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: "weekly goal deleted",
        properties: { goal_id: id },
      });
    }

    return c.body(null, 204);
  } catch (e) {
    return dbError(c, e);
  }
}
