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
