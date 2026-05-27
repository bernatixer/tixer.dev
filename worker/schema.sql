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

-- Enable Banking integration. Each `bank_sessions` row is a PSD2
-- authorization (max 90 days). It exposes one or more `bank_accounts`,
-- and we persist their transactions in `bank_transactions` keyed by the
-- provider's transaction id so re-syncs are idempotent.
CREATE TABLE IF NOT EXISTS bank_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    eb_session_id TEXT NOT NULL,                    -- Enable Banking's session id
    aspsp_name TEXT NOT NULL,                       -- e.g. 'Revolut'
    aspsp_country TEXT NOT NULL,                    -- ISO-2 country code
    status TEXT NOT NULL DEFAULT 'active',          -- 'active' | 'expired' | 'revoked'
    authorized_at TEXT NOT NULL,
    valid_until TEXT NOT NULL,                      -- end of 90-day PSD2 window
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bank_sessions_user_id ON bank_sessions(user_id);

CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    eb_account_uid TEXT NOT NULL,                   -- Enable Banking's account uid
    name TEXT,
    iban_masked TEXT,                                -- last-4 only, never full IBAN
    currency TEXT NOT NULL,
    last_synced_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_session_id ON bank_accounts(session_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);

CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    eb_transaction_id TEXT NOT NULL,                -- for dedup across syncs
    booking_date TEXT NOT NULL,                     -- YYYY-MM-DD
    value_date TEXT,
    amount_cents INTEGER NOT NULL,                  -- negative = outflow
    user_amount_cents INTEGER,                      -- override for splits/reimbursements
    currency TEXT NOT NULL,
    counterparty TEXT,                              -- merchant or counterparty name
    description TEXT,
    category TEXT NOT NULL DEFAULT 'other',         -- assigned by our categorizer
    category_source TEXT NOT NULL DEFAULT 'derived',-- 'derived' | 'ai' | 'manual'
    excluded INTEGER NOT NULL DEFAULT 0,            -- 1 = hidden from analytics (still visible in table)
    spread_months INTEGER,                          -- amortize amount over N months starting from booking_date
    raw_json TEXT NOT NULL,                         -- full provider payload for debugging
    created_at TEXT NOT NULL,
    UNIQUE(account_id, eb_transaction_id)
);
-- If the bank_transactions table existed before columns were added, run once:
--   wrangler d1 execute DB --local --command "ALTER TABLE bank_transactions ADD COLUMN category TEXT NOT NULL DEFAULT 'other'"
--   wrangler d1 execute DB --local --command "ALTER TABLE bank_transactions ADD COLUMN category_source TEXT NOT NULL DEFAULT 'derived'"
--   wrangler d1 execute DB --local --command "ALTER TABLE bank_transactions ADD COLUMN user_amount_cents INTEGER"
--   wrangler d1 execute DB --local --command "ALTER TABLE bank_transactions ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute DB --local --command "ALTER TABLE bank_transactions ADD COLUMN spread_months INTEGER"
-- (same with --remote in CI for production).
--
-- category_source: 'derived' (rule-based) | 'ai' | 'manual'
-- user_amount_cents: overrides amount_cents in aggregates when set (for splits / reimbursements)

-- Per-user cache of merchant → category so we only pay the AI categorizer
-- once per unique merchant. counterparty_key is lowercased + trimmed for
-- consistent matching.
CREATE TABLE IF NOT EXISTS bank_category_cache (
    user_id TEXT NOT NULL,
    counterparty_key TEXT NOT NULL,
    category TEXT NOT NULL,
    source TEXT NOT NULL,                            -- 'ai' | 'manual'
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, counterparty_key)
);

CREATE INDEX IF NOT EXISTS idx_bank_category_cache_user_id ON bank_category_cache(user_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_date ON bank_transactions(user_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_date ON bank_transactions(account_id, booking_date DESC);

-- Pending OAuth states. We mint a random `state` when starting POST /auth,
-- redirect the user to the bank, and look it up in the callback to defend
-- against CSRF and recover the ASPSP/redirect context.
CREATE TABLE IF NOT EXISTS bank_auth_states (
    state TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    aspsp_name TEXT NOT NULL,
    aspsp_country TEXT NOT NULL,
    redirect_url TEXT NOT NULL,
    expires_at TEXT NOT NULL,                       -- TTL ~15 min
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bank_auth_states_user_id ON bank_auth_states(user_id);
