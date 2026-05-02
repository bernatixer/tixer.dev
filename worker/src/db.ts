// Mapping between D1 rows and the JSON shapes the Rust backend produced.
// The Rust code stored RFC3339 datetimes, JSON-encoded arrays/objects, and
// lowercase enum strings as plain TEXT — we keep that exact representation.

import type {
  BlockedBy,
  ColumnId,
  Milestone,
  Priority,
  Recurrence,
  Tag,
  Task,
  TaskType,
} from "./types";

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: string;
  column_id: string;
  tags: string;
  due_date: string | null;
  created_at: string;
  recurrence: string | null;
  subtasks: string;
  order: number;
  blocked_by: string | null;
  task_type: string | null;
  url: string | null;
  completed_at: string | null;
}

interface TagRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

const VALID_PRIORITIES: readonly Priority[] = ["urgent", "high", "medium", "low"];
const VALID_COLUMNS: readonly ColumnId[] = ["inbox", "todo", "blocked", "doing", "done"];
const VALID_RECURRENCE: readonly Recurrence[] = ["daily", "weekly", "monthly", "yearly"];
const VALID_TASK_TYPES: readonly TaskType[] = ["task", "book", "video", "article", "movie"];

function asEnum<T extends string>(allowed: readonly T[], value: string, label: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Invalid ${label}: ${value}`);
}

export function rowToTask(row: TaskRow): Task {
  const milestones = JSON.parse(row.subtasks) as Milestone[];
  const tags = JSON.parse(row.tags) as string[];
  const blockedBy = row.blocked_by ? (JSON.parse(row.blocked_by) as BlockedBy) : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: asEnum(VALID_PRIORITIES, row.priority, "priority"),
    columnId: asEnum(VALID_COLUMNS, row.column_id, "columnId"),
    tags,
    dueDate: row.due_date,
    createdAt: row.created_at,
    recurrence: row.recurrence
      ? asEnum(VALID_RECURRENCE, row.recurrence, "recurrence")
      : null,
    milestones,
    order: row.order,
    blockedBy,
    taskType: row.task_type
      ? asEnum(VALID_TASK_TYPES, row.task_type, "taskType")
      : "task",
    url: row.url,
    completedAt: row.completed_at,
  };
}

export function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export type { TaskRow, TagRow };
