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

export interface WeeklyGoal {
  id: string;
  weekStart: string;     // ISO date, Monday (YYYY-MM-DD)
  title: string;
  target: number;
  progress: number;
  recurring: boolean;
  order: number;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateWeeklyGoalRequest {
  weekStart?: string;    // defaults to current week on the server
  title: string;
  target?: number;
  progress?: number;
  recurring?: boolean;
  order?: number;
}

// ============================================
// BANK INTEGRATION — Enable Banking
// ============================================

export type BankSessionStatus = "active" | "expired" | "revoked";

export interface BankSession {
  id: string;
  ebSessionId: string;
  aspspName: string;
  aspspCountry: string;
  status: BankSessionStatus;
  authorizedAt: string;
  validUntil: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  sessionId: string;
  ebAccountUid: string;
  name: string | null;
  ibanMasked: string | null;
  currency: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

export type BankCategory =
  | "housing"
  | "transport"
  | "food"
  | "clothing"
  | "beauty"
  | "decoration"
  | "fitness"
  | "travel"
  | "leisure"
  | "gifts"
  | "investment"
  // System-only:
  | "income"
  | "transfer"
  | "other"; // default for any uncategorized transaction

export type BankCategorySource = "derived" | "ai" | "manual";

export interface BankTransaction {
  id: string;
  accountId: string;
  ebTransactionId: string;
  bookingDate: string;
  valueDate: string | null;
  amountCents: number;            // negative = outflow (original from bank)
  userAmountCents: number | null; // override for splits / reimbursements
  currency: string;
  counterparty: string | null;
  description: string | null;
  category: BankCategory;
  categorySource: BankCategorySource;
  excluded: boolean;              // hidden from analytics but visible in table
  spreadMonths: number | null;    // amortize over N months from bookingDate (null = no spread)
  createdAt: string;
}

export interface SyncResult {
  accountId: string;
  newTransactions: number;
  totalSeen: number;
  lastSyncedAt: string;
}

export interface Env {
  DB: D1Database;
  CLERK_PEM_PUBLIC_KEY: string;
  CLERK_ISSUER_URL?: string;
  ZAI_API_KEY: string;
  COMMIT_SHA?: string;
  ENABLE_BANKING_APP_ID?: string;
  ENABLE_BANKING_PRIVATE_KEY?: string;
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
}

export interface Variables {
  userId: string;
  phSessionId?: string;
}
