// Domain types — JSON shapes match the Rust backend exactly.
// Keep enum string values lowercase. Dates over the wire are RFC3339 strings.

export type Priority = "urgent" | "high" | "medium" | "low";
export type ColumnId = "inbox" | "todo" | "blocked" | "doing" | "done";
export type Recurrence = "daily" | "weekly" | "monthly" | "yearly";
export type TaskType = "task" | "book" | "video" | "article" | "movie";
export type TagId = string;

export type BlockedBy =
  | { type: "text"; reason: string }
  | { type: "task"; taskId: string };

export interface Milestone {
  id: string;
  text: string;
  completed: boolean;
}

export interface Tag {
  id: TagId;
  name: string;
  color: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  columnId: ColumnId;
  tags: TagId[];
  dueDate: string | null;
  createdAt: string;
  recurrence: Recurrence | null;
  milestones: Milestone[];
  order: number;
  blockedBy: BlockedBy | null;
  taskType: TaskType;
  url: string | null;
  completedAt: string | null;
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  priority: Priority;
  columnId: ColumnId;
  tags?: TagId[];
  dueDate?: string | null;
  recurrence?: Recurrence | null;
  milestones?: Milestone[];
  // back-compat: Rust accepts `subtasks` as alias for milestones on input
  subtasks?: Milestone[];
  order?: number;
  blockedBy?: BlockedBy | null;
  taskType?: TaskType;
  url?: string | null;
  completedAt?: string | null;
}

export interface CreateTagRequest {
  name: string;
  color: string;
}

export interface Env {
  DB: D1Database;
  CLERK_PEM_PUBLIC_KEY: string;
  CLERK_ISSUER_URL?: string;
  ZAI_API_KEY: string;
}

export interface Variables {
  userId: string;
}
