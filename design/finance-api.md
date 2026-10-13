# Encrypted finance storage API

The Worker stores an opaque, versioned encryption envelope. It does not decrypt,
calculate financial values, accept plaintext finance fields, or log finance
request bodies. Every finance response, including authentication failures,
preflight, conflicts and server errors, carries `Cache-Control: no-store`.
Finance paths bypass the Worker's PostHog initialization and flush middleware.

## Authentication and configuration

Send a Clerk session token as `Authorization: Bearer <token>`. Finance uses the
existing installed `jose` library and an RS256 PEM public key, following
[Clerk's manual verification guidance](https://clerk.com/docs/guides/sessions/manual-jwt-verification).
The board's existing authentication behavior is unchanged.

- `DB`: existing D1 binding, with the updated idempotent `worker/schema.sql` applied.
- `CLERK_PEM_PUBLIC_KEY`: matching Clerk instance public key. Escaped `\n` is accepted.
- `CLERK_ISSUER_URL`: mandatory exact issuer origin, without a trailing slash.
  Missing issuer or invalid PEM fails closed with 503 for finance.
- `CLERK_AUTHORIZED_PARTIES`: optional comma-separated exact authorized origins.
  Defaults to `https://focus.tixer.dev`, `http://localhost:3000`, and
  `http://127.0.0.1:3000`, matching the existing CORS allowlist. Set it to
  `https://focus.tixer.dev` to restrict finance tokens to production. An explicitly
  empty or malformed list disables finance. This setting restricts authentication;
  expanding the separate CORS allowlist requires an explicit code change.

Signature, RS256 algorithm, pinned issuer, required numeric `exp` and `nbf`,
nonempty `sub` and `sid`, and required allowlisted `azp` are checked. Expired,
premature, pending-session, malformed and untrusted tokens receive the same
generic 401 response. The requirement for `azp` is intentionally stricter than
Clerk's optional handling of an absent authorized-party claim. There is no
cookie-based finance authentication or authentication bypass for tests.

Existing CI applies the schema before deploying worker changes. No production
database operation or deployment was performed during implementation. The new
table's schema is final for this feature branch; it does not alter existing tables.

## HTTP contract

The endpoint is `/api/finance/vault`. Reads and mutations always derive ownership
from the verified token subject; request bodies cannot select a user.

| Method | Body | Success |
| --- | --- | --- |
| GET | none | 200 `{ envelope, revision, updatedAt }` |
| PUT create | `{ expectedRevision: 0, expectedVaultId: null, envelope }` | 201 `{ envelope, revision, updatedAt }` |
| PUT update/import | `{ expectedRevision, expectedVaultId, envelope }` | 200 `{ envelope, revision, updatedAt }` |
| DELETE | `{ expectedRevision, vaultId }` | 204, empty body |

`expectedRevision` is a nonnegative safe integer; update/delete require a positive
value below `Number.MAX_SAFE_INTEGER`. IDs are lowercase UUIDv4 strings. An update
compares the old `expectedVaultId` and can replace it with the imported envelope's
ID. `updatedAt` is an ISO UTC timestamp. PUT responses include the normalized
validated envelope; clients must use the returned revision, including after create.

GET returns 404 only when the authenticated owner's vault is absent or deleted.
401, 503, transport failure and 500 must remain errors and must never be treated
as permission to create an absent vault. Invalid bodies/envelopes receive 400,
excessive bodies 413, incorrect content types 415, and unsupported methods 405.
Compare-and-swap failure receives 409; clients preserve unlocked local edits and
require an explicit reload or replacement decision. Configuration failures use
503 and database/corrupt-record failures use 500 with a generic error. Database
details, JWT verification details and ciphertext are excluded from error messages.

## Envelope and request limits

PUT/DELETE require `application/json`. The body is bounded to 524,288 bytes while
streaming, before parsing JSON. A missing or deceptive content length does not
remove that limit. Every envelope object has exact keys; unknown fields, unknown
versions, altered algorithms/work factors and noncanonical base64 are rejected.
The pure validator is intentionally duplicated in the independently built Focus
and Worker apps (`focus/src/finance/envelope.ts`, `worker/src/financeEnvelope.ts`).

Version 1 has `version`, `vaultId`, `cipher`, `kdf`, `passwordWrap`, `recoveryWrap`,
and `payload`. The cipher is `AES-256-GCM`. Argon2id is fixed at version 19,
65,536 KiB memory, 3 iterations, parallelism 1 and 32-byte output; the salt is
16 bytes. Each encrypted part contains only `nonce` (12 bytes) and `ciphertext`.
Each key wrap ciphertext is 48 bytes (32-byte key plus 16-byte GCM tag). Payload
ciphertext is between 16 and 262,160 bytes, permitting at most 256 KiB plaintext.
Binary values use canonical padded standard base64. The serialized validated
envelope is also bounded to 512 KiB. The Worker never runs Argon2 or AES itself.

## Atomicity and deletion

`financial_vaults` has one row per user: `user_id` primary key, `vault_id`, envelope
JSON, monotonic revision, update timestamp and an explicit deleted flag. Vault IDs
need not be globally unique: restoring the same backup into a different Clerk
account does not grant either account access to the other's row.

Create is a single INSERT/upsert that only replaces a deleted row. Updates are a
single conditional UPDATE comparing user, old vault ID, revision and live state.
Delete is a single conditional UPDATE comparing the same fields, clearing the
envelope, setting deleted state and incrementing the revision. Each statement
uses `RETURNING`; no read-before-write window determines whether it succeeds.
The implementation uses D1's
[prepared statements and first-row result contract](https://developers.cloudflare.com/d1/worker-api/prepared-statements/).

Deletion retains only owner, opaque ID, revision, timestamp and deleted state.
Retaining this ciphertext-free tombstone prevents revision reuse: create at 1,
delete at 2, then restore at 3. Even restoring an old backup with its original ID
cannot make a stale revision-1 delete or update valid again. Account-level storage
erasure beyond ciphertext deletion would need a separate policy that accounts for
this protection. Provider backups may retain old ciphertext under their own
retention policy. Possession of an old encrypted backup and its old secret still
allows decrypting that backup; valid ciphertext rollback is not fully detectable
without trusted external state.

## Local verification

Run `cd worker && node tests/run.mjs` with Node 24 and installed existing worker
dependencies, or `pnpm test` when the repository's pnpm build approvals are set.
The runner bundles TypeScript using esbuild already installed through Wrangler,
then runs Node's test runner. No additional test dependency is installed.

Tests run real SQLite statements from the actual schema behind a small D1-shaped
adapter and route real signed synthetic RS256 JWTs through the actual Hono app.
They cover absent versus failed reads, strict claims and signatures, independent
owners, competing creates/updates, stale writes/deletes, imported IDs, retained
revisions after deletion, bounded streams, largest accepted ciphertext, malformed
envelopes, schema reapplication and finance analytics exclusion. The adapter
exercises SQL atomicity locally; it does not emulate remote D1 transport failure
or verify deployed Clerk credentials. Worker typechecking is also required.

For browser integration, `cd worker && node tests/serve.mjs` starts a loopback-only
test API at `http://127.0.0.1:5556`; set the Vite harness API URL to
`http://localhost:5556/api` and use origin `http://localhost:3000`. It generates a
temporary RSA key and synthetic Clerk-shaped session, then forwards actual HTTP
requests through the production Hono router and the same real SQLite adapter.
`GET /__test/token` returns the signed synthetic token; `GET /__test/inspect`
returns ciphertext and metadata; `POST /__test/fail-next` forces the next PUT to
return 500; `POST /__test/reset` clears only this in-memory test database. These
helpers exist exclusively in the test server, never in Worker routes. No request
contents are printed. `FINANCE_TEST_PORT` overrides the test port. Run the server
with `--self-check` to exercise real HTTP auth, create, failed update and deletion
and exit. Browser checks using this server verify the actual API/auth/SQL boundary;
interactive deployed Clerk sign-in still requires a separate credentialed check.
