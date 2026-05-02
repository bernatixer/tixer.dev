import type { Context } from "hono";
import { rowToTag, type TagRow, type TaskRow } from "../db";
import type { CreateTagRequest, Env, Variables } from "../types";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

function dbError(c: Ctx, e: unknown) {
  return c.json({ error: `DB error: ${(e as Error).message}` }, 500);
}

export async function listTags(c: Ctx) {
  const userId = c.get("userId");
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, user_id, name, color, created_at FROM tags WHERE user_id = ? ORDER BY created_at ASC",
    )
      .bind(userId)
      .all<TagRow>();
    return c.json(results.map(rowToTag));
  } catch (e) {
    return dbError(c, e);
  }
}

export async function createTag(c: Ctx) {
  const userId = c.get("userId");
  let body: CreateTagRequest;
  try {
    body = await c.req.json<CreateTagRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    await c.env.DB.prepare(
      "INSERT INTO tags (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(id, userId, body.name, body.color, createdAt)
      .run();
  } catch (e) {
    return dbError(c, e);
  }

  return c.json({ id, name: body.name, color: body.color, createdAt }, 201);
}

export async function deleteTag(c: Ctx) {
  const userId = c.get("userId");
  const id = c.req.param("id");

  try {
    const result = await c.env.DB.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();
    if (!result.meta.changes) return c.json({ error: "Tag not found" }, 404);

    // Mirror Rust: strip the deleted tag id from every task's tags JSON array.
    const { results } = await c.env.DB.prepare(
      'SELECT id, user_id, title, description, priority, column_id, tags, due_date, created_at, recurrence, subtasks, "order", blocked_by, task_type, url, completed_at FROM tasks WHERE user_id = ? AND tags LIKE ?',
    )
      .bind(userId, `%${id}%`)
      .all<TaskRow>();

    for (const row of results) {
      const tags: string[] = JSON.parse(row.tags);
      const filtered = tags.filter((t) => t !== id);
      if (filtered.length === tags.length) continue;
      await c.env.DB.prepare("UPDATE tasks SET tags = ? WHERE id = ? AND user_id = ?")
        .bind(JSON.stringify(filtered), row.id, userId)
        .run();
    }

    return c.body(null, 204);
  } catch (e) {
    return dbError(c, e);
  }
}
