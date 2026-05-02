import type { Context } from "hono";
import { rowToTask, type TaskRow } from "../db";
import type {
  CreateTaskRequest,
  Env,
  Task,
  Variables,
} from "../types";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

const SELECT_COLS =
  'SELECT id, user_id, title, description, priority, column_id, tags, due_date, created_at, recurrence, subtasks, "order", blocked_by, task_type, url, completed_at FROM tasks';

function dbError(c: Ctx, e: unknown) {
  return c.json({ error: `DB error: ${(e as Error).message}` }, 500);
}

export async function listTasks(c: Ctx) {
  const userId = c.get("userId");
  try {
    const { results } = await c.env.DB.prepare(
      `${SELECT_COLS} WHERE user_id = ? ORDER BY column_id, "order", created_at DESC`,
    )
      .bind(userId)
      .all<TaskRow>();
    return c.json(results.map(rowToTask));
  } catch (e) {
    return dbError(c, e);
  }
}

export async function getTask(c: Ctx) {
  const userId = c.get("userId");
  const id = c.req.param("id");
  try {
    const row = await c.env.DB.prepare(`${SELECT_COLS} WHERE id = ? AND user_id = ?`)
      .bind(id, userId)
      .first<TaskRow>();
    if (!row) return c.json({ error: "Task not found" }, 404);
    return c.json(rowToTask(row));
  } catch (e) {
    return dbError(c, e);
  }
}

export async function createTask(c: Ctx) {
  const userId = c.get("userId");
  let body: CreateTaskRequest;
  try {
    body = await c.req.json<CreateTaskRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const milestonesJson = JSON.stringify(body.milestones ?? body.subtasks ?? []);
  const tagsJson = JSON.stringify(body.tags ?? []);
  const blockedByJson = body.blockedBy ? JSON.stringify(body.blockedBy) : null;
  const taskType = body.taskType ?? "task";
  const dueDate = body.dueDate ?? null;
  const recurrence = body.recurrence ?? null;
  const description = body.description ?? null;
  const url = body.url ?? null;

  // Mirror Rust: completed_at only persisted when columnId is "done".
  let completedAt: string | null = null;
  if (body.columnId === "done") {
    completedAt = body.completedAt ?? new Date().toISOString();
  }

  // Mirror Rust: when order is 0/missing, place after current max in column.
  let order = body.order ?? 0;
  if (order === 0) {
    try {
      const row = await c.env.DB.prepare(
        'SELECT COALESCE(MAX("order"), -1) + 1 AS next_order FROM tasks WHERE column_id = ? AND user_id = ?',
      )
        .bind(body.columnId, userId)
        .first<{ next_order: number }>();
      order = row?.next_order ?? 0;
    } catch (e) {
      return dbError(c, e);
    }
  }

  try {
    await c.env.DB.prepare(
      `INSERT INTO tasks (id, user_id, title, description, priority, column_id, tags, due_date, created_at, recurrence, subtasks, "order", blocked_by, task_type, url, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        userId,
        body.title,
        description,
        body.priority,
        body.columnId,
        tagsJson,
        dueDate,
        createdAt,
        recurrence,
        milestonesJson,
        order,
        blockedByJson,
        taskType,
        url,
        completedAt,
      )
      .run();
  } catch (e) {
    return dbError(c, e);
  }

  const task: Task = {
    id,
    title: body.title,
    description,
    priority: body.priority,
    columnId: body.columnId,
    tags: body.tags ?? [],
    dueDate,
    createdAt,
    recurrence,
    milestones: body.milestones ?? body.subtasks ?? [],
    order,
    blockedBy: body.blockedBy ?? null,
    taskType,
    url,
    completedAt,
  };
  return c.json(task, 201);
}

export async function updateTask(c: Ctx) {
  const userId = c.get("userId");
  const id = c.req.param("id");
  let body: Task;
  try {
    body = await c.req.json<Task>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  let existing: TaskRow | null;
  try {
    existing = await c.env.DB.prepare(`${SELECT_COLS} WHERE id = ? AND user_id = ?`)
      .bind(id, userId)
      .first<TaskRow>();
  } catch (e) {
    return dbError(c, e);
  }
  if (!existing) return c.json({ error: "Task not found" }, 404);

  const milestonesJson = JSON.stringify(body.milestones ?? []);
  const tagsJson = JSON.stringify(body.tags ?? []);
  const blockedByJson = body.blockedBy ? JSON.stringify(body.blockedBy) : null;

  // Mirror Rust update_task: when in "done", reuse provided completedAt, else
  // existing completedAt, else now. Otherwise null.
  let completedAt: string | null = null;
  if (body.columnId === "done") {
    completedAt = body.completedAt ?? existing.completed_at ?? new Date().toISOString();
  }

  try {
    const result = await c.env.DB.prepare(
      `UPDATE tasks
       SET title = ?, description = ?, priority = ?, column_id = ?, tags = ?, due_date = ?, recurrence = ?, subtasks = ?, "order" = ?, blocked_by = ?, task_type = ?, url = ?, completed_at = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(
        body.title,
        body.description ?? null,
        body.priority,
        body.columnId,
        tagsJson,
        body.dueDate ?? null,
        body.recurrence ?? null,
        milestonesJson,
        body.order,
        blockedByJson,
        body.taskType ?? "task",
        body.url ?? null,
        completedAt,
        id,
        userId,
      )
      .run();
    if (!result.meta.changes) return c.json({ error: "Task not found" }, 404);
  } catch (e) {
    return dbError(c, e);
  }

  return c.json({ ...body, completedAt });
}

export async function deleteTask(c: Ctx) {
  const userId = c.get("userId");
  const id = c.req.param("id");
  try {
    const result = await c.env.DB.prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();
    if (!result.meta.changes) return c.json({ error: "Task not found" }, 404);
    return c.body(null, 204);
  } catch (e) {
    return dbError(c, e);
  }
}
