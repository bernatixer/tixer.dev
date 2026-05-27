// Mapping between D1 rows and the JSON shapes the Rust backend produced.
// The Rust code stored RFC3339 datetimes, JSON-encoded arrays/objects, and
// lowercase enum strings as plain TEXT — we keep that exact representation.

import type {
  BankAccount,
  BankCategory,
  BankCategorySource,
  BankSession,
  BankSessionStatus,
  BankTransaction,
  BlockedBy,
  ColumnId,
  Milestone,
  Priority,
  Recurrence,
  Tag,
  Task,
  TaskType,
  WeeklyGoal,
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

interface WeeklyGoalRow {
  id: string;
  user_id: string;
  week_start: string;
  title: string;
  target: number;
  progress: number;
  recurring: number;
  order: number;
  created_at: string;
  completed_at: string | null;
}

export function rowToWeeklyGoal(row: WeeklyGoalRow): WeeklyGoal {
  return {
    id: row.id,
    weekStart: row.week_start,
    title: row.title,
    target: row.target,
    progress: row.progress,
    recurring: row.recurring === 1,
    order: row.order,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

interface BankSessionRow {
  id: string;
  user_id: string;
  eb_session_id: string;
  aspsp_name: string;
  aspsp_country: string;
  status: string;
  authorized_at: string;
  valid_until: string;
  created_at: string;
}

interface BankAccountRow {
  id: string;
  user_id: string;
  session_id: string;
  eb_account_uid: string;
  name: string | null;
  iban_masked: string | null;
  currency: string;
  last_synced_at: string | null;
  created_at: string;
}

interface BankTransactionRow {
  id: string;
  user_id: string;
  account_id: string;
  eb_transaction_id: string;
  booking_date: string;
  value_date: string | null;
  amount_cents: number;
  user_amount_cents: number | null;
  currency: string;
  counterparty: string | null;
  description: string | null;
  category: string;
  category_source: string;
  excluded: number;
  spread_months: number | null;
  raw_json: string;
  created_at: string;
}

const VALID_BANK_CATEGORIES: readonly BankCategory[] = [
  "housing",
  "transport",
  "food",
  "clothing",
  "beauty",
  "decoration",
  "fitness",
  "travel",
  "leisure",
  "gifts",
  "investment",
  "income",
  "transfer",
  "other",
];

const VALID_CATEGORY_SOURCES: readonly BankCategorySource[] = ["derived", "ai", "manual"];

const VALID_BANK_STATUS: readonly BankSessionStatus[] = ["active", "expired", "revoked"];

export function rowToBankSession(row: BankSessionRow): BankSession {
  return {
    id: row.id,
    ebSessionId: row.eb_session_id,
    aspspName: row.aspsp_name,
    aspspCountry: row.aspsp_country,
    status: asEnum(VALID_BANK_STATUS, row.status, "bank session status"),
    authorizedAt: row.authorized_at,
    validUntil: row.valid_until,
    createdAt: row.created_at,
  };
}

export function rowToBankAccount(row: BankAccountRow): BankAccount {
  return {
    id: row.id,
    sessionId: row.session_id,
    ebAccountUid: row.eb_account_uid,
    name: row.name,
    ibanMasked: row.iban_masked,
    currency: row.currency,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
  };
}

export function rowToBankTransaction(row: BankTransactionRow): BankTransaction {
  return {
    id: row.id,
    accountId: row.account_id,
    ebTransactionId: row.eb_transaction_id,
    bookingDate: row.booking_date,
    valueDate: row.value_date,
    amountCents: row.amount_cents,
    userAmountCents: row.user_amount_cents,
    currency: row.currency,
    counterparty: row.counterparty,
    description: row.description,
    category: VALID_BANK_CATEGORIES.includes(row.category as BankCategory)
      ? (row.category as BankCategory)
      : "other",
    categorySource: VALID_CATEGORY_SOURCES.includes(row.category_source as BankCategorySource)
      ? (row.category_source as BankCategorySource)
      : "derived",
    excluded: row.excluded === 1,
    spreadMonths: row.spread_months ?? null,
    createdAt: row.created_at,
  };
}

export type {
  TaskRow,
  TagRow,
  WeeklyGoalRow,
  BankSessionRow,
  BankAccountRow,
  BankTransactionRow,
};
