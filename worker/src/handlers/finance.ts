import type { Context } from "hono";
import { MAX_ENVELOPE_BYTES, parseEnvelope, type VaultEnvelope } from "../financeEnvelope";
import type { Env, Variables } from "../types";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;
type VaultRow = { vault_id: string; envelope: string; revision: number; updated_at: string };
const VAULT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class InvalidRequest extends Error {
  constructor(readonly status: 400 | 413 | 415 = 400) { super(); }
}

async function boundedJson(c: Ctx): Promise<unknown> {
  if (c.req.header("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new InvalidRequest(415);
  }
  const declared = c.req.header("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_ENVELOPE_BYTES)) {
    throw new InvalidRequest(Number(declared) > MAX_ENVELOPE_BYTES ? 413 : 400);
  }
  const reader = c.req.raw.body?.getReader();
  if (!reader) throw new InvalidRequest();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > MAX_ENVELOPE_BYTES) {
        await reader.cancel();
        throw new InvalidRequest(413);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(buffer));
  } catch {
    throw new InvalidRequest();
  }
}

function exactObject(input: unknown, keys: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input, key))) {
    throw new InvalidRequest();
  }
  return input as Record<string, unknown>;
}

function revision(input: unknown, minimum: number): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < minimum ||
    input >= Number.MAX_SAFE_INTEGER) throw new InvalidRequest();
  return input;
}

function vaultId(input: unknown): string {
  if (typeof input !== "string" || !VAULT_ID.test(input)) throw new InvalidRequest();
  return input;
}

function response(row: VaultRow) {
  const envelope = parseEnvelope(JSON.parse(row.envelope));
  if (envelope.vaultId !== row.vault_id || !Number.isSafeInteger(row.revision) || row.revision < 1 ||
    new Date(row.updated_at).toISOString() !== row.updated_at) throw new Error();
  return { envelope, revision: row.revision, updatedAt: row.updated_at };
}

function failure(c: Ctx, error: unknown) {
  if (error instanceof InvalidRequest) return c.json({ error: "Invalid finance request" }, error.status);
  return c.json({ error: "Finance unavailable" }, 500);
}

export async function getFinanceVault(c: Ctx) {
  try {
    const row = await c.env.DB.prepare(
      "SELECT vault_id, envelope, revision, updated_at FROM financial_vaults WHERE user_id = ? AND deleted = 0",
    ).bind(c.get("userId")).first<VaultRow>();
    if (!row) return c.json({ error: "Vault not found" }, 404);
    return c.json(response(row));
  } catch (error) {
    return failure(c, error);
  }
}

export async function putFinanceVault(c: Ctx) {
  let expectedRevision: number;
  let expectedVaultId: string | null;
  let envelope: VaultEnvelope;
  try {
    const body = exactObject(await boundedJson(c), ["expectedRevision", "expectedVaultId", "envelope"]);
    expectedRevision = revision(body.expectedRevision, 0);
    expectedVaultId = expectedRevision === 0 ? null : vaultId(body.expectedVaultId);
    if (expectedRevision === 0 && body.expectedVaultId !== null) throw new InvalidRequest();
    try { envelope = parseEnvelope(body.envelope); } catch { throw new InvalidRequest(); }
  } catch (error) {
    return failure(c, error);
  }
  const userId = c.get("userId");
  const updatedAt = new Date().toISOString();
  try {
    // boffin: kept revision history after deletion so restoring an old id cannot revive stale writes.
    const query = expectedRevision === 0
      ? c.env.DB.prepare(`INSERT INTO financial_vaults (user_id, vault_id, envelope, revision, updated_at, deleted)
          VALUES (?, ?, ?, 1, ?, 0)
          ON CONFLICT(user_id) DO UPDATE SET vault_id = excluded.vault_id, envelope = excluded.envelope,
            revision = financial_vaults.revision + 1, updated_at = excluded.updated_at, deleted = 0
          WHERE financial_vaults.deleted = 1 AND financial_vaults.revision < 9007199254740991
          RETURNING vault_id, envelope, revision, updated_at`)
        .bind(userId, envelope.vaultId, JSON.stringify(envelope), updatedAt)
      : c.env.DB.prepare(`UPDATE financial_vaults SET vault_id = ?, envelope = ?, revision = revision + 1, updated_at = ?
          WHERE user_id = ? AND vault_id = ? AND revision = ? AND deleted = 0
          RETURNING vault_id, envelope, revision, updated_at`)
        .bind(envelope.vaultId, JSON.stringify(envelope), updatedAt, userId, expectedVaultId, expectedRevision);
    const row = await query.first<VaultRow>();
    if (!row) return c.json({ error: "Vault conflict" }, 409);
    return c.json(response(row), expectedRevision === 0 ? 201 : 200);
  } catch (error) {
    return failure(c, error);
  }
}

export async function deleteFinanceVault(c: Ctx) {
  let expectedRevision: number;
  let id: string;
  try {
    const body = exactObject(await boundedJson(c), ["expectedRevision", "vaultId"]);
    expectedRevision = revision(body.expectedRevision, 1);
    id = vaultId(body.vaultId);
  } catch (error) {
    return failure(c, error);
  }
  try {
    const row = await c.env.DB.prepare(`UPDATE financial_vaults
        SET envelope = NULL, deleted = 1, revision = revision + 1, updated_at = ?
        WHERE user_id = ? AND vault_id = ? AND revision = ? AND deleted = 0 RETURNING revision`)
      .bind(new Date().toISOString(), c.get("userId"), id, expectedRevision).first<{ revision: number }>();
    if (!row) return c.json({ error: "Vault conflict" }, 409);
    return c.body(null, 204);
  } catch (error) {
    return failure(c, error);
  }
}
