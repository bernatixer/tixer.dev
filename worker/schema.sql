-- Tixer schema for Cloudflare D1 (SQLite-compatible).
-- Mirrors the consolidated state of back/src/db/sqlite.rs after all ALTERs.

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL,
    column_id TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    due_date TEXT,
    created_at TEXT NOT NULL,
    recurrence TEXT,
    subtasks TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    blocked_by TEXT,
    task_type TEXT DEFAULT 'task',
    url TEXT,
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- Weekly goals — bono-loto style card displayed at the top of the board.
-- A goal is either simple (target=1) or a counter (target>1). When
-- `recurring=1`, the row is materialized for the next ISO-week-Monday with
-- progress reset.
CREATE TABLE IF NOT EXISTS weekly_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    week_start TEXT NOT NULL,                       -- ISO date, Monday of the week (YYYY-MM-DD)
    title TEXT NOT NULL,
    target INTEGER NOT NULL DEFAULT 1,
    progress INTEGER NOT NULL DEFAULT 0,
    recurring INTEGER NOT NULL DEFAULT 0,           -- 1 = re-materialize next week
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_weekly_goals_user_week ON weekly_goals(user_id, week_start);
