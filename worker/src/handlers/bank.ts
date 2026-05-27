// ============================================
// BANK HANDLERS — Enable Banking integration
// ============================================
//
// Restricted-mode flow (single-user, hobbyist):
//
// 1. You linked your Revolut in the Enable Banking control panel
//    ("Activate by linking accounts"). That produced a session on their side.
// 2. You take that session_id from the EB dashboard and POST it to
//    /api/bank/sessions/import — we fetch its details, store the session +
//    its accounts in D1.
// 3. /api/bank/sync pulls transactions from each linked account into D1,
//    deduping by Enable Banking's transaction id.
// 4. /api/bank/transactions returns the stored rows for the UI.
//
// This avoids building our own OAuth UI for v1 — the EB portal handles SCA.

import type { Context } from "hono";
import {
  EnableBankingClient,
  EnableBankingError,
  counterpartyOf,
  descriptionOf,
  ebTransactionId,
  normalizeAmountCents,
} from "../enableBanking";
import { getPostHog, getPhSessionId } from "../posthog";
import {
  rowToBankAccount,
  rowToBankSession,
  rowToBankTransaction,
  type BankAccountRow,
  type BankSessionRow,
  type BankTransactionRow,
} from "../db";
import type { Env, SyncResult, Variables } from "../types";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

const SESSION_COLS =
  "SELECT id, user_id, eb_session_id, aspsp_name, aspsp_country, status, authorized_at, valid_until, created_at FROM bank_sessions";
const ACCOUNT_COLS =
  "SELECT id, user_id, session_id, eb_account_uid, name, iban_masked, currency, last_synced_at, created_at FROM bank_accounts";
const TX_COLS =
  "SELECT id, user_id, account_id, eb_transaction_id, booking_date, value_date, amount_cents, user_amount_cents, currency, counterparty, description, category, category_source, excluded, spread_months, raw_json, created_at FROM bank_transactions";

function dbError(c: Ctx, e: unknown) {
  return c.json({ error: `DB error: ${(e as Error).message}` }, 500);
}

function configError(c: Ctx) {
  return c.json(
    {
      error:
        "Enable Banking is not configured. Set ENABLE_BANKING_APP_ID and ENABLE_BANKING_PRIVATE_KEY in worker secrets.",
    },
    503,
  );
}

// PSD2 caps consent at 180 days, but most banks enforce 90 days.
const DEFAULT_CONSENT_DAYS = 89;

function randomState(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getClient(c: Ctx): EnableBankingClient | null {
  const appId = c.env.ENABLE_BANKING_APP_ID;
  const pem = c.env.ENABLE_BANKING_PRIVATE_KEY;
  if (!appId || !pem) return null;
  return new EnableBankingClient({ appId, privateKeyPem: pem });
}

function maskIban(input: string | undefined | null): string | null {
  if (!input) return null;
  if (input.length <= 4) return input;
  return `…${input.slice(-4)}`;
}

function pickIban(acc: { iban?: string; other?: { identification: string } } | undefined): string | undefined {
  if (!acc) return undefined;
  return acc.iban ?? acc.other?.identification;
}

// Given a session that exists locally but has no bank_accounts rows yet,
// fetch the account UIDs from Enable Banking, then fetch each account's
// details, and insert. Idempotent — skips UIDs we already have stored.
async function populateAccountsForSession(
  c: Ctx,
  client: EnableBankingClient,
  args: { localSessionId: string; ebSessionId: string; userId: string },
): Promise<{ inserted: number; skipped: number }> {
  const { localSessionId, ebSessionId, userId } = args;
  let ebSession;
  try {
    ebSession = await client.getSession(ebSessionId);
  } catch (e) {
    console.error("[populateAccounts] failed to fetch session", e);
    throw e;
  }
  const uids = ebSession.accounts ?? (ebSession.accounts_data ?? []).map((a) => a.uid);

  const { results: existingRows } = await c.env.DB.prepare(
    "SELECT eb_account_uid FROM bank_accounts WHERE session_id = ? AND user_id = ?",
  )
    .bind(localSessionId, userId)
    .all<{ eb_account_uid: string }>();
  const existing = new Set(existingRows.map((r) => r.eb_account_uid));

  let inserted = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const uid of uids) {
    if (existing.has(uid)) {
      skipped += 1;
      continue;
    }
    let details;
    try {
      details = await client.getAccountDetails(uid);
    } catch (e) {
      console.error(`[populateAccounts] /accounts/${uid}/details failed`, e);
      // Best effort: insert with minimal info so the UID isn't lost.
      details = { currency: "EUR" } as Awaited<ReturnType<typeof client.getAccountDetails>>;
    }
    const accountId = crypto.randomUUID();
    try {
      await c.env.DB.prepare(
        `INSERT INTO bank_accounts (id, user_id, session_id, eb_account_uid, name, iban_masked, currency, last_synced_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      )
        .bind(
          accountId,
          userId,
          localSessionId,
          uid,
          details.name ?? details.product ?? null,
          maskIban(pickIban(details.account_id)),
          details.currency ?? "EUR",
          now,
        )
        .run();
      inserted += 1;
    } catch (e) {
      console.error(`[populateAccounts] failed to insert uid=${uid}`, e);
    }
  }

  return { inserted, skipped };
}

// ============================================
// CONFIG STATUS
// ============================================

export async function bankStatus(c: Ctx) {
  const configured = !!(c.env.ENABLE_BANKING_APP_ID && c.env.ENABLE_BANKING_PRIVATE_KEY);
  if (!configured) {
    return c.json({ configured: false });
  }
  const client = getClient(c)!;
  try {
    const app = await client.getApplication();
    return c.json({ configured: true, app });
  } catch (e) {
    if (e instanceof EnableBankingError) {
      return c.json({ configured: true, error: e.message, status: e.status }, 502);
    }
    return c.json({ configured: true, error: (e as Error).message }, 500);
  }
}

// ============================================
// SESSIONS — list local
// ============================================

export async function listBankSessions(c: Ctx) {
  const userId = c.get("userId");
  try {
    const { results } = await c.env.DB.prepare(
      `${SESSION_COLS} WHERE user_id = ? ORDER BY created_at DESC`,
    )
      .bind(userId)
      .all<BankSessionRow>();
    return c.json({ sessions: results.map(rowToBankSession) });
  } catch (e) {
    return dbError(c, e);
  }
}

// ============================================
// SESSIONS — import (from EB dashboard)
// ============================================

interface ImportSessionRequest {
  ebSessionId: string;
}

export async function importBankSession(c: Ctx) {
  const userId = c.get("userId");
  const client = getClient(c);
  if (!client) return configError(c);

  let body: ImportSessionRequest;
  try {
    body = await c.req.json<ImportSessionRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.ebSessionId) return c.json({ error: "ebSessionId is required" }, 400);

  let session;
  try {
    session = await client.getSession(body.ebSessionId);
  } catch (e) {
    if (e instanceof EnableBankingError) {
      if (e.status === 404) {
        return c.json(
          {
            error:
              "Enable Banking doesn't recognize that session_id. Make sure you're copying the session_id from the request logs (Control Panel → your app → Requests → most recent POST /sessions response), not the application id or an account uid.",
          },
          404,
        );
      }
      return c.json({ error: e.message }, 502);
    }
    throw e;
  }

  if (session.status !== "AUTHORIZED") {
    return c.json(
      { error: `Session is not AUTHORIZED (status: ${session.status}). Re-link in Enable Banking.` },
      400,
    );
  }

  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();
  const validUntil = session.access?.valid_until ?? new Date(Date.now() + 89 * 86400_000).toISOString();

  try {
    await c.env.DB.prepare(
      `INSERT INTO bank_sessions (id, user_id, eb_session_id, aspsp_name, aspsp_country, status, authorized_at, valid_until, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    )
      .bind(
        sessionId,
        userId,
        session.session_id,
        session.aspsp.name,
        session.aspsp.country,
        session.authorized_at ?? now,
        validUntil,
        now,
      )
      .run();

    await populateAccountsForSession(c, client, {
      localSessionId: sessionId,
      ebSessionId: session.session_id,
      userId,
    });
  } catch (e) {
    return dbError(c, e);
  }

  const posthog = getPostHog(c.env);
  if (posthog) {
    const phSessionId = getPhSessionId(c);
    await posthog.captureImmediate({
      distinctId: userId,
      event: "bank session imported",
      properties: {
        bank_session_id: sessionId,
        aspsp_name: session.aspsp.name,
        aspsp_country: session.aspsp.country,
        ...(phSessionId ? { $session_id: phSessionId } : {}),
      },
    });
  }

  return c.json({ ok: true, sessionId }, 201);
}

// ============================================
// SESSIONS — disconnect
// ============================================

export async function deleteBankSession(c: Ctx) {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const client = getClient(c);
  if (!client) return configError(c);

  try {
    const row = await c.env.DB.prepare(
      `${SESSION_COLS} WHERE id = ? AND user_id = ?`,
    )
      .bind(id, userId)
      .first<BankSessionRow>();
    if (!row) return c.json({ error: "Session not found" }, 404);

    // Best-effort revoke on Enable Banking's side; ignore failures so we
    // always clean up local state even if the remote call errors.
    try {
      await client.deleteSession(row.eb_session_id);
    } catch {
      // ignore
    }

    await c.env.DB.prepare(
      "DELETE FROM bank_transactions WHERE user_id = ? AND account_id IN (SELECT id FROM bank_accounts WHERE session_id = ?)",
    )
      .bind(userId, id)
      .run();
    await c.env.DB.prepare("DELETE FROM bank_accounts WHERE user_id = ? AND session_id = ?")
      .bind(userId, id)
      .run();
    await c.env.DB.prepare("DELETE FROM bank_sessions WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();

    return c.body(null, 204);
  } catch (e) {
    return dbError(c, e);
  }
}

// ============================================
// ACCOUNTS — list local
// ============================================

export async function listBankAccounts(c: Ctx) {
  const userId = c.get("userId");
  try {
    const { results } = await c.env.DB.prepare(
      `${ACCOUNT_COLS} WHERE user_id = ? ORDER BY created_at ASC`,
    )
      .bind(userId)
      .all<BankAccountRow>();
    return c.json({ accounts: results.map(rowToBankAccount) });
  } catch (e) {
    return dbError(c, e);
  }
}

// ============================================
// SYNC — fetch transactions from EB into D1
// ============================================

const DEFAULT_LOOKBACK_DAYS = 90;

export async function syncBank(c: Ctx) {
  const userId = c.get("userId");
  const client = getClient(c);
  if (!client) return configError(c);

  try {
    let { results: accounts } = await c.env.DB.prepare(
      `${ACCOUNT_COLS} WHERE user_id = ?`,
    )
      .bind(userId)
      .all<BankAccountRow>();

    // Auto-backfill: if we have sessions but no accounts (e.g. POST /sessions
    // didn't return rich data), populate them from Enable Banking now.
    if (accounts.length === 0) {
      const { results: sessions } = await c.env.DB.prepare(
        "SELECT id, eb_session_id FROM bank_sessions WHERE user_id = ? AND status = 'active'",
      )
        .bind(userId)
        .all<{ id: string; eb_session_id: string }>();

      for (const s of sessions) {
        await populateAccountsForSession(c, client, {
          localSessionId: s.id,
          ebSessionId: s.eb_session_id,
          userId,
        });
      }

      const refreshed = await c.env.DB.prepare(
        `${ACCOUNT_COLS} WHERE user_id = ?`,
      )
        .bind(userId)
        .all<BankAccountRow>();
      accounts = refreshed.results;
    }

    if (accounts.length === 0) {
      return c.json({ results: [], note: "No bank accounts linked yet. Connect a bank first." });
    }

    const now = new Date();
    const dateTo = now.toISOString().slice(0, 10);
    const dateFromObj = new Date(now);
    dateFromObj.setUTCDate(dateFromObj.getUTCDate() - DEFAULT_LOOKBACK_DAYS);
    const dateFrom = dateFromObj.toISOString().slice(0, 10);

    const out: SyncResult[] = [];

    for (const acc of accounts) {
      let newCount = 0;
      let totalSeen = 0;
      let continuationKey: string | undefined = undefined;
      // Cap iterations defensively
      for (let page = 0; page < 20; page++) {
        const resp = await client.getTransactions(acc.eb_account_uid, {
          dateFrom,
          dateTo,
          continuationKey,
        });
        for (const tx of resp.transactions) {
          totalSeen += 1;
          const ebId = ebTransactionId(tx);
          const bookingDate = tx.booking_date ?? tx.value_date ?? tx.transaction_date ?? dateTo;
          const amountCents = normalizeAmountCents(tx);
          const counterparty = counterpartyOf(tx);
          const description = descriptionOf(tx);
          const rawJson = JSON.stringify(tx);
          try {
            // Default new transactions to uncategorized — the user
            // categorizes by hand (Tinder triage, picker, modal). The only
            // automatic step is honoring a prior manual decision for the
            // same merchant via the cache.
            let finalCategory = "other";
            let finalSource = "derived";
            if (counterparty) {
              const cached = await c.env.DB.prepare(
                `SELECT category, source FROM bank_category_cache
                 WHERE user_id = ? AND counterparty_key = ? AND source = 'manual'`,
              )
                .bind(userId, counterparty.toLowerCase().trim())
                .first<{ category: string; source: string }>();
              if (cached) {
                finalCategory = cached.category;
                finalSource = "manual";
              }
            }
            const result = await c.env.DB.prepare(
              `INSERT INTO bank_transactions
                 (id, user_id, account_id, eb_transaction_id, booking_date, value_date, amount_cents, currency, counterparty, description, category, category_source, raw_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(account_id, eb_transaction_id) DO NOTHING`,
            )
              .bind(
                crypto.randomUUID(),
                userId,
                acc.id,
                ebId,
                bookingDate,
                tx.value_date ?? null,
                amountCents,
                tx.transaction_amount.currency,
                counterparty,
                description,
                finalCategory,
                finalSource,
                rawJson,
                new Date().toISOString(),
              )
              .run();
            if (result.meta.changes) newCount += 1;
          } catch {
            // Skip transactions that fail to insert (likely conflict races)
          }
        }
        if (!resp.continuation_key) break;
        continuationKey = resp.continuation_key;
      }

      const lastSyncedAt = new Date().toISOString();
      await c.env.DB.prepare(
        "UPDATE bank_accounts SET last_synced_at = ? WHERE id = ? AND user_id = ?",
      )
        .bind(lastSyncedAt, acc.id, userId)
        .run();

      out.push({
        accountId: acc.id,
        newTransactions: newCount,
        totalSeen,
        lastSyncedAt,
      });
    }

    const posthog = getPostHog(c.env);
    if (posthog) {
      const phSessionId = getPhSessionId(c);
      const totalNew = out.reduce((sum, r) => sum + r.newTransactions, 0);
      await posthog.captureImmediate({
        distinctId: userId,
        event: "bank synced",
        properties: {
          account_count: out.length,
          total_new_transactions: totalNew,
          ...(phSessionId ? { $session_id: phSessionId } : {}),
        },
      });
    }

    return c.json({ results: out });
  } catch (e) {
    if (e instanceof EnableBankingError) {
      return c.json({ error: e.message, status: e.status }, 502);
    }
    return dbError(c, e);
  }
}

// ============================================
// OAUTH — start auth
// ============================================

interface StartAuthRequest {
  aspspName?: string;       // defaults to "Revolut"
  aspspCountry?: string;    // defaults to "ES"
  redirectUrl: string;      // must match a Redirect URL registered in EB control panel
}

export async function startBankAuth(c: Ctx) {
  const userId = c.get("userId");
  const client = getClient(c);
  if (!client) return configError(c);

  let body: StartAuthRequest;
  try {
    body = await c.req.json<StartAuthRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.redirectUrl) return c.json({ error: "redirectUrl is required" }, 400);

  const aspspName = body.aspspName ?? "Revolut";
  const aspspCountry = body.aspspCountry ?? "ES";

  const state = randomState();
  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setUTCDate(validUntil.getUTCDate() + DEFAULT_CONSENT_DAYS);
  const expiresAt = new Date(now);
  expiresAt.setUTCMinutes(expiresAt.getUTCMinutes() + 15);

  let authResp;
  try {
    authResp = await client.startAuth({
      aspspName,
      aspspCountry,
      state,
      redirectUrl: body.redirectUrl,
      validUntilIso: validUntil.toISOString(),
    });
  } catch (e) {
    if (e instanceof EnableBankingError) {
      return c.json({ error: e.message, status: e.status }, 502);
    }
    throw e;
  }

  try {
    await c.env.DB.prepare(
      `INSERT INTO bank_auth_states (state, user_id, aspsp_name, aspsp_country, redirect_url, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(state, userId, aspspName, aspspCountry, body.redirectUrl, expiresAt.toISOString(), now.toISOString())
      .run();
  } catch (e) {
    return dbError(c, e);
  }

  const posthog = getPostHog(c.env);
  if (posthog) {
    const phSessionId = getPhSessionId(c);
    await posthog.captureImmediate({
      distinctId: userId,
      event: "bank auth started",
      properties: {
        aspsp_name: aspspName,
        aspsp_country: aspspCountry,
        ...(phSessionId ? { $session_id: phSessionId } : {}),
      },
    });
  }

  return c.json({ url: authResp.url, state });
}

// ============================================
// OAUTH — finalize (called from the /bank/callback page)
// ============================================

interface FinalizeAuthRequest {
  state: string;
  code: string;
}

export async function finalizeBankAuth(c: Ctx) {
  const userId = c.get("userId");
  const client = getClient(c);
  if (!client) return configError(c);

  let body: FinalizeAuthRequest;
  try {
    body = await c.req.json<FinalizeAuthRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.state || !body.code) {
    return c.json({ error: "state and code are required" }, 400);
  }

  // Validate state belongs to this user and hasn't expired
  let stateRow: {
    state: string;
    user_id: string;
    aspsp_name: string;
    aspsp_country: string;
    expires_at: string;
  } | null;
  try {
    stateRow = await c.env.DB.prepare(
      "SELECT state, user_id, aspsp_name, aspsp_country, expires_at FROM bank_auth_states WHERE state = ? AND user_id = ?",
    )
      .bind(body.state, userId)
      .first();
  } catch (e) {
    return dbError(c, e);
  }
  if (!stateRow) return c.json({ error: "Unknown or already-used state" }, 400);
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return c.json({ error: "Auth state expired. Restart the connection." }, 400);
  }

  let ebSession;
  try {
    ebSession = await client.createSession(body.code);
  } catch (e) {
    if (e instanceof EnableBankingError) {
      return c.json({ error: e.message }, 502);
    }
    throw e;
  }

  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();
  const validUntil = ebSession.access?.valid_until ?? new Date(Date.now() + DEFAULT_CONSENT_DAYS * 86400_000).toISOString();

  try {
    await c.env.DB.prepare(
      `INSERT INTO bank_sessions (id, user_id, eb_session_id, aspsp_name, aspsp_country, status, authorized_at, valid_until, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    )
      .bind(
        sessionId,
        userId,
        ebSession.session_id,
        ebSession.aspsp.name,
        ebSession.aspsp.country,
        ebSession.authorized_at ?? now,
        validUntil,
        now,
      )
      .run();

    await populateAccountsForSession(c, client, {
      localSessionId: sessionId,
      ebSessionId: ebSession.session_id,
      userId,
    });

    // Consume the state
    await c.env.DB.prepare("DELETE FROM bank_auth_states WHERE state = ?")
      .bind(body.state)
      .run();
  } catch (e) {
    return dbError(c, e);
  }

  const posthog = getPostHog(c.env);
  if (posthog) {
    const phSessionId = getPhSessionId(c);
    await posthog.captureImmediate({
      distinctId: userId,
      event: "bank auth completed",
      properties: {
        bank_session_id: sessionId,
        aspsp_name: ebSession.aspsp.name,
        aspsp_country: ebSession.aspsp.country,
        ...(phSessionId ? { $session_id: phSessionId } : {}),
      },
    });
  }

  return c.json({ ok: true, sessionId }, 201);
}

// ============================================
// TRANSACTIONS — list local
// ============================================

export async function listBankTransactions(c: Ctx) {
  const userId = c.get("userId");
  const limit = Math.min(Number(c.req.query("limit") ?? "200"), 1000);

  try {
    const { results } = await c.env.DB.prepare(
      `${TX_COLS} WHERE user_id = ? ORDER BY booking_date DESC, created_at DESC LIMIT ?`,
    )
      .bind(userId, limit)
      .all<BankTransactionRow>();
    return c.json({ transactions: results.map(rowToBankTransaction) });
  } catch (e) {
    return dbError(c, e);
  }
}

// ============================================
// UPDATE A SINGLE TRANSACTION — manual override
// ============================================
//
// Lets the user set a category that survives any future re-categorize,
// optionally cache it for all transactions from the same merchant, and
// set an "actual amount" (user_amount_cents) for splits/reimbursements.

interface UpdateTransactionRequest {
  category?: string;
  userAmountCents?: number | null;
  applyCategoryToMerchant?: boolean;
  excluded?: boolean;
  spreadMonths?: number | null;
}

export async function updateBankTransaction(c: Ctx) {
  const userId = c.get("userId");
  const txId = c.req.param("id");

  let body: UpdateTransactionRequest;
  try {
    body = await c.req.json<UpdateTransactionRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Look up the row first so we know counterparty (for cache writes) and
  // can validate ownership.
  const row = await c.env.DB.prepare(
    `${TX_COLS} WHERE id = ? AND user_id = ?`,
  )
    .bind(txId, userId)
    .first<BankTransactionRow>();
  if (!row) return c.json({ error: "Transaction not found" }, 404);

  const validCategories = new Set([
    "housing", "transport", "food", "clothing", "beauty", "decoration",
    "fitness", "travel", "leisure", "gifts", "investment", "income", "transfer", "other",
  ]);

  const nextCategory =
    body.category && validCategories.has(body.category) ? body.category : null;
  const userAmount =
    body.userAmountCents === null
      ? null
      : typeof body.userAmountCents === "number" && Number.isFinite(body.userAmountCents)
        ? Math.round(body.userAmountCents)
        : undefined; // undefined = no change

  try {
    if (nextCategory) {
      await c.env.DB.prepare(
        `UPDATE bank_transactions
         SET category = ?, category_source = 'manual'
         WHERE id = ? AND user_id = ?`,
      )
        .bind(nextCategory, txId, userId)
        .run();
    }

    if (userAmount !== undefined) {
      await c.env.DB.prepare(
        `UPDATE bank_transactions
         SET user_amount_cents = ?
         WHERE id = ? AND user_id = ?`,
      )
        .bind(userAmount, txId, userId)
        .run();
    }

    if (body.excluded !== undefined) {
      await c.env.DB.prepare(
        `UPDATE bank_transactions
         SET excluded = ?
         WHERE id = ? AND user_id = ?`,
      )
        .bind(body.excluded ? 1 : 0, txId, userId)
        .run();
    }

    if (body.spreadMonths !== undefined) {
      // null clears the spread; positive integers set it. Clamp 1..120 to
      // prevent silly values; 1 effectively means "no spread" so coerce.
      const raw = body.spreadMonths;
      let value: number | null;
      if (raw === null) value = null;
      else if (typeof raw === "number" && Number.isFinite(raw) && raw > 1) {
        value = Math.min(120, Math.floor(raw));
      } else {
        value = null;
      }
      await c.env.DB.prepare(
        `UPDATE bank_transactions
         SET spread_months = ?
         WHERE id = ? AND user_id = ?`,
      )
        .bind(value, txId, userId)
        .run();
    }

    let appliedToCount = 0;
    if (nextCategory && body.applyCategoryToMerchant && row.counterparty) {
      const key = row.counterparty.toLowerCase().trim();
      // Upsert the cache row with source = 'manual' so it wins over ai/derived
      await c.env.DB.prepare(
        `INSERT INTO bank_category_cache (user_id, counterparty_key, category, source, created_at)
         VALUES (?, ?, ?, 'manual', ?)
         ON CONFLICT(user_id, counterparty_key) DO UPDATE SET
           category = excluded.category,
           source = 'manual',
           created_at = excluded.created_at`,
      )
        .bind(userId, key, nextCategory, new Date().toISOString())
        .run();
      // Bulk-apply to every other transaction from the same merchant
      const result = await c.env.DB.prepare(
        `UPDATE bank_transactions
         SET category = ?, category_source = 'manual'
         WHERE user_id = ? AND id != ? AND LOWER(TRIM(counterparty)) = ?`,
      )
        .bind(nextCategory, userId, txId, key)
        .run();
      appliedToCount = result.meta.changes ?? 0;
    }

    const posthog = getPostHog(c.env);
    if (posthog && nextCategory) {
      const phSessionId = getPhSessionId(c);
      await posthog.captureImmediate({
        distinctId: userId,
        event: "bank transaction categorized",
        properties: {
          transaction_id: txId,
          category: nextCategory,
          applied_to_merchant: !!(body.applyCategoryToMerchant && row.counterparty),
          applied_to_count: appliedToCount,
          ...(phSessionId ? { $session_id: phSessionId } : {}),
        },
      });
    }

    return c.json({ ok: true, appliedToMerchantCount: appliedToCount });
  } catch (e) {
    return dbError(c, e);
  }
}
