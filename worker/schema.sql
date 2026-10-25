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

-- A deleted row retains only metadata so revisions cannot repeat after restore.
CREATE TABLE IF NOT EXISTS financial_vaults (
    user_id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    envelope TEXT,
    revision INTEGER NOT NULL CHECK (revision > 0),
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
    CHECK ((deleted = 0 AND envelope IS NOT NULL) OR (deleted = 1 AND envelope IS NULL))
);

CREATE TABLE IF NOT EXISTS weight_entries (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    PRIMARY KEY (user_id, date)
);

-- A phase applies from start_date until the next phase starts.
CREATE TABLE IF NOT EXISTS weight_phases (
    user_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    maintenance_kcal INTEGER NOT NULL,
    intake_kcal INTEGER NOT NULL,
    protein_g_per_kg REAL,
    PRIMARY KEY (user_id, start_date)
);

CREATE TABLE IF NOT EXISTS weight_profiles (
    user_id TEXT PRIMARY KEY,
    age INTEGER NOT NULL,
    height_cm REAL NOT NULL,
    sex TEXT NOT NULL CHECK (sex IN ('male', 'female')),
    activity_factor REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS weight_activity (
    user_id TEXT PRIMARY KEY,
    steps_per_day INTEGER NOT NULL CHECK (steps_per_day BETWEEN 0 AND 100000),
    sport TEXT NOT NULL CHECK (sport IN ('none', 'strength', 'cycling', 'running', 'swimming')),
    sport_minutes REAL NOT NULL CHECK (sport_minutes BETWEEN 0 AND 600),
    sport_days_per_week REAL NOT NULL CHECK (sport_days_per_week BETWEEN 0 AND 14)
);

CREATE TABLE IF NOT EXISTS weight_goals (
    user_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    start_weight_kg REAL NOT NULL,
    target_date TEXT NOT NULL,
    target_weight_kg REAL NOT NULL,
    PRIMARY KEY (user_id, start_date)
);

-- One Telegram chat per user; reminders fire at remind_hour in time_zone.
CREATE TABLE IF NOT EXISTS telegram_links (
    user_id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL UNIQUE,
    time_zone TEXT NOT NULL,
    remind_hour INTEGER NOT NULL,
    last_reminded TEXT
);

-- Short-lived codes the bot hands out; entering one in Focus proves the chat is yours.
CREATE TABLE IF NOT EXISTS telegram_codes (
    code TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

-- Meals estimated from a description or photo; kcal can be corrected by hand.
CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    kcal INTEGER NOT NULL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    saturated_g REAL,
    fibre_g REAL,
    sugar_g REAL,
    telegram_message_id INTEGER,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date);

-- Per-user override of the daily meal-estimate cap; users without a row get the default in meals.ts.
CREATE TABLE IF NOT EXISTS meal_estimate_limits (
    user_id TEXT PRIMARY KEY,
    per_day INTEGER NOT NULL CHECK (per_day >= 0)
);

-- Every estimate counts, food or not, since each one is a paid model call.
CREATE TABLE IF NOT EXISTS meal_estimate_usage (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (user_id, date)
);
