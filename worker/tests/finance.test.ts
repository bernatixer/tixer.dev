import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import app from '../src/index.ts';
import { database as openDatabase } from './sqlite.ts';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const publicPem = await exportSPKI(publicKey);
const issuer = 'https://finance-test.clerk.accounts.dev';
const azp = 'https://focus.tixer.dev';
const databases: ReturnType<typeof openDatabase>[] = [];
after(() => databases.forEach(db => db.sqlite.close()));

function database() {
  const db = openDatabase();
  databases.push(db);
  return db;
}

function environment(db = database()) {
  return { DB: db, CLERK_PEM_PUBLIC_KEY: publicPem, CLERK_ISSUER_URL: issuer,
    CLERK_AUTHORIZED_PARTIES: azp, ZAI_API_KEY: '' };
}

async function token(user = 'user-a', claims: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = { iss: issuer, sub: user, sid: 'session-test',
    azp, nbf: now - 2, exp: now + 300, ...claims };
  return new SignJWT(payload).setProtectedHeader({ alg: 'RS256' }).sign(privateKey);
}

async function request(env: ReturnType<typeof environment>, method = 'GET', body?: unknown, auth?: string) {
  return app.request('/api/finance/vault', { method,
    headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, env as never);
}

function envelope(vaultId = '11111111-1111-4111-8111-111111111111') {
  const base64 = (bytes: number, fill = 0) => Buffer.alloc(bytes, fill).toString('base64');
  return {
    version: 1, vaultId, cipher: 'AES-256-GCM',
    kdf: { name: 'argon2id', version: 19, memoryKiB: 65536, iterations: 3,
      parallelism: 1, hashLength: 32, salt: base64(16) },
    passwordWrap: { nonce: base64(12), ciphertext: base64(48) },
    recoveryWrap: { nonce: base64(12, 1), ciphertext: base64(48) },
    payload: { nonce: base64(12, 2), ciphertext: base64(32) },
  };
}

function putBody(value = envelope(), expectedRevision = 0, expectedVaultId: string | null = null) {
  return { expectedRevision, expectedVaultId, envelope: value };
}

test('finance rejects unauthenticated requests and disables caching on failure', async () => {
  const response = await request(environment());
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('a valid signed session sees an absent vault instead of an authentication failure', async () => {
  const response = await request(environment(), 'GET', undefined, await token());
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('finance requires current signed Clerk session claims and an allowed authorized party', async () => {
  const now = Math.floor(Date.now() / 1000);
  const badClaims = [
    { exp: undefined }, { nbf: undefined }, { sub: undefined }, { sid: undefined },
    { iss: undefined }, { azp: undefined }, { exp: now - 1 }, { nbf: now + 120 },
    { iss: 'https://another.clerk.accounts.dev' }, { azp: 'https://untrusted.example' },
    { sub: '' }, { sid: '' }, { exp: 'tomorrow' }, { nbf: 'yesterday' }, { sts: 'pending' },
  ];
  const env = environment();
  for (const claims of badClaims) {
    const response = await request(env, 'GET', undefined, await token('user-a', claims));
    assert.equal(response.status, 401, JSON.stringify(claims));
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('missing issuer or invalid key disables finance without exposing configuration', async () => {
  const auth = await token();
  for (const overrides of [{ CLERK_ISSUER_URL: '' }, { CLERK_PEM_PUBLIC_KEY: 'secret-invalid-key' },
    { CLERK_AUTHORIZED_PARTIES: 'https://focus.tixer.dev/path' }]) {
    const response = await request({ ...environment(), ...overrides }, 'GET', undefined, auth);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Finance unavailable' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('ciphertext storage is isolated by verified owner and every successful response is uncached', async () => {
  const env = environment();
  const alice = await token('alice');
  const bob = await token('bob');
  const created = await request(env, 'PUT', putBody(), alice);
  assert.equal(created.status, 201);
  const value = await created.json();
  assert.deepEqual(value.envelope, envelope());
  assert.equal(value.revision, 1);
  assert.match(value.updatedAt, /^\d{4}-\d\d-\d\dT/);
  assert.equal(created.headers.get('cache-control'), 'no-store');
  assert.equal((await request(env, 'GET', undefined, bob)).status, 404);
  assert.equal((await request(env, 'PUT', putBody(envelope(), 1, envelope().vaultId), bob)).status, 409);
  assert.equal((await request(env, 'DELETE', { expectedRevision: 1, vaultId: envelope().vaultId }, bob)).status, 409);
  const stored = await request(env, 'GET', undefined, alice);
  assert.deepEqual(await stored.json(), value);
  const row = env.DB.sqlite.prepare('SELECT * FROM financial_vaults').get();
  assert.deepEqual(Object.keys(row!).sort(), ['deleted', 'envelope', 'revision', 'updated_at', 'user_id', 'vault_id']);
  assert.equal(row!.user_id, 'alice');
});

test('atomic creation and revision checks allow exactly one competing writer', async () => {
  const env = environment();
  const auth = await token();
  const other = envelope('22222222-2222-4222-8222-222222222222');
  const creates = await Promise.all([
    request(env, 'PUT', putBody(), auth), request(env, 'PUT', putBody(other), auth),
  ]);
  assert.deepEqual(creates.map(response => response.status).sort(), [201, 409]);
  const current = await (await request(env, 'GET', undefined, auth)).json();
  const body = putBody(current.envelope, 1, current.envelope.vaultId);
  const updates = await Promise.all([request(env, 'PUT', body, auth), request(env, 'PUT', body, auth)]);
  assert.deepEqual(updates.map(response => response.status).sort(), [200, 409]);
  assert.equal((await (await request(env, 'GET', undefined, auth)).json()).revision, 2);
});

test('delete compares id and revision, erases ciphertext, and retains revisions across restored IDs', async () => {
  const env = environment();
  const auth = await token();
  await request(env, 'PUT', putBody(), auth);
  await request(env, 'PUT', putBody(envelope(), 1, envelope().vaultId), auth);
  const staleDelete = { expectedRevision: 1, vaultId: envelope().vaultId };
  assert.equal((await request(env, 'DELETE', staleDelete, auth)).status, 409);
  assert.equal((await request(env, 'DELETE', { expectedRevision: 2,
    vaultId: '22222222-2222-4222-8222-222222222222' }, auth)).status, 409);
  assert.equal((await request(env, 'DELETE', { ...staleDelete, expectedRevision: 2 }, auth)).status, 204);
  assert.equal((await request(env, 'GET', undefined, auth)).status, 404);
  const tombstone = env.DB.sqlite.prepare('SELECT * FROM financial_vaults').get();
  assert.equal(tombstone!.envelope, null);
  assert.equal(tombstone!.deleted, 1);
  assert.equal(tombstone!.revision, 3);
  const recreated = await request(env, 'PUT', putBody(), auth);
  assert.equal(recreated.status, 201);
  assert.equal((await recreated.json()).revision, 4);
  assert.equal((await request(env, 'DELETE', staleDelete, auth)).status, 409);
  assert.equal((await request(env, 'PUT', putBody(envelope(), 1, envelope().vaultId), auth)).status, 409);
});

test('replacement compares the old id and can install a validated imported envelope id', async () => {
  const env = environment();
  const auth = await token();
  await request(env, 'PUT', putBody(), auth);
  const replacement = envelope('22222222-2222-4222-8222-222222222222');
  const response = await request(env, 'PUT', putBody(replacement, 1, envelope().vaultId), auth);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).envelope, replacement);
  assert.equal((await request(env, 'PUT', putBody(envelope(), 2, envelope().vaultId), auth)).status, 409);
});

test('the same encrypted backup can be restored into another account without sharing ownership', async () => {
  const env = environment();
  const alice = await token('alice');
  const bob = await token('bob');
  assert.equal((await request(env, 'PUT', putBody(), alice)).status, 201);
  assert.equal((await request(env, 'PUT', putBody(), bob)).status, 201);
  assert.equal((await request(env, 'DELETE', { expectedRevision: 1, vaultId: envelope().vaultId }, bob)).status, 204);
  assert.equal((await request(env, 'GET', undefined, alice)).status, 200);
  assert.equal((await request(env, 'GET', undefined, bob)).status, 404);
});

test('invalid and excessive envelopes cannot mutate storage', async () => {
  const env = environment();
  const auth = await token();
  const invalid = [
    { ...putBody(), extra: 'plaintext' }, { ...putBody(), expectedRevision: -1 },
    { ...putBody(), expectedRevision: 0.5 }, { ...putBody(), expectedRevision: 1 },
    putBody({ ...envelope(), version: 2 }), putBody({ ...envelope(), extra: 'secret' }),
    putBody({ ...envelope(), kdf: { ...envelope().kdf, memoryKiB: 2 ** 30 } }),
    putBody({ ...envelope(), payload: { ...envelope().payload, nonce: 'invalid' } }),
    putBody({ ...envelope(), passwordWrap: { ...envelope().passwordWrap, ciphertext: 'AAAA' } }),
    putBody({ ...envelope(), payload: { ...envelope().payload, ciphertext: Buffer.alloc(262161).toString('base64') } }),
  ];
  for (const value of invalid) {
    assert.equal((await request(env, 'PUT', value, auth)).status, 400);
  }
  assert.equal((await request(env, 'GET', undefined, auth)).status, 404);
  const oversized = await request(env, 'PUT', { extra: 'x'.repeat(512 * 1024) }, auth);
  assert.equal(oversized.status, 413);
  assert.equal(oversized.headers.get('cache-control'), 'no-store');
});

test('database failures remain distinct from absent vaults and disclose no contents', async () => {
  const env = environment();
  const auth = await token();
  env.DB.sqlite.exec('DROP TABLE financial_vaults');
  for (const [method, body] of [['GET', undefined], ['PUT', putBody()],
    ['DELETE', { expectedRevision: 1, vaultId: envelope().vaultId }]] as const) {
    const response = await request(env, method, body, auth);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Finance unavailable' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('finance never initializes or flushes worker analytics even after repeated access', async () => {
  const env = environment();
  Object.defineProperty(env, 'POSTHOG_KEY', { get() { throw new Error('Analytics must not read finance requests'); } });
  const auth = await token();
  assert.equal((await request(env)).status, 401);
  assert.equal((await request(env, 'GET', undefined, auth)).status, 404);
  assert.equal((await request(env, 'PUT', putBody(), auth)).status, 201);
  assert.equal((await request(env, 'GET', undefined, auth)).status, 200);
  assert.equal((await request(env, 'DELETE', { expectedRevision: 1, vaultId: envelope().vaultId }, auth)).status, 204);
});

test('request size is counted while streaming even without or with a false content length', async () => {
  const env = environment();
  const auth = await token();
  for (const declared of [undefined, '1', String(512 * 1024 + 1)]) {
    let remaining = 100;
    let cancelled = false;
    const body = new ReadableStream({
      pull(controller) {
        if (remaining-- > 0) controller.enqueue(new Uint8Array(65536).fill(120));
        else controller.close();
      },
      cancel() { cancelled = true; },
    });
    const headers = { authorization: `Bearer ${auth}`, 'content-type': 'application/json',
      ...(declared ? { 'content-length': declared } : {}) };
    const response = await app.request(new Request('http://localhost/api/finance/vault', {
      method: 'PUT', headers, body, duplex: 'half',
    } as RequestInit), undefined, env as never);
    assert.equal(response.status, 413);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    if (declared !== String(512 * 1024 + 1)) assert.equal(cancelled, true);
  }
  assert.equal((await request(env, 'GET', undefined, auth)).status, 404);
});

test('valid maximum ciphertext remains accepted while malformed JSON and noncanonical base64 fail', async () => {
  const env = environment();
  const auth = await token();
  const largest = envelope();
  largest.payload.ciphertext = Buffer.alloc(262160).toString('base64');
  assert.equal((await request(env, 'PUT', putBody(largest), auth)).status, 201);
  const malformed = await app.request('/api/finance/vault', { method: 'PUT',
    headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' }, body: '{oops',
  }, env as never);
  assert.equal(malformed.status, 400);
  const noncanonical = envelope();
  noncanonical.kdf.salt = 'AAAAAAAAAAAAAAAAAAAAAB==';
  assert.equal((await request(env, 'PUT', putBody(noncanonical, 1, noncanonical.vaultId), auth)).status, 400);
});

test('finance rejects a tampered signature and tokens signed by an unrelated key or algorithm', async () => {
  const env = environment();
  const valid = await token();
  const pieces = valid.split('.');
  pieces[2] = (pieces[2][0] === 'A' ? 'B' : 'A') + pieces[2].slice(1);
  const unrelated = await generateKeyPair('RS256');
  const payload = { iss: issuer, sub: 'user-a', sid: 'session-a', azp, nbf: 1, exp: 9999999999 };
  const wrongKey = await new SignJWT(payload).setProtectedHeader({ alg: 'RS256' }).sign(unrelated.privateKey);
  const wrongAlgorithm = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).sign(new Uint8Array(32));
  for (const invalid of [pieces.join('.'), wrongKey, wrongAlgorithm]) {
    assert.equal((await request(env, 'GET', undefined, invalid)).status, 401);
  }
});

test('schema application is idempotent and leaves existing board rows intact', () => {
  const db = database();
  db.sqlite.exec("INSERT INTO tags (id,user_id,name,color,created_at) VALUES ('existing','owner','keep','#fff','2026-01-01')");
  db.sqlite.exec(readFileSync('schema.sql', 'utf8'));
  assert.equal(db.sqlite.prepare("SELECT name FROM tags WHERE id='existing'").get()!.name, 'keep');
});

test('preflight and unsupported methods are uncached and never invoke analytics', async () => {
  const env = environment();
  Object.defineProperty(env, 'POSTHOG_KEY', { get() { throw new Error('Unexpected analytics'); } });
  const preflight = await app.request('/api/finance/vault', { method: 'OPTIONS', headers: {
    origin: azp, 'access-control-request-method': 'PUT',
  } }, env as never);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('cache-control'), 'no-store');
  const unsupported = await request(env, 'POST', putBody(), await token());
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get('cache-control'), 'no-store');
});

test('a corrupt stored envelope or revision is a server error rather than absence', async () => {
  const env = environment();
  const auth = await token();
  assert.equal((await request(env, 'PUT', putBody(), auth)).status, 201);
  const original = JSON.stringify(envelope());
  for (const value of ['{invalid', JSON.stringify({ ...envelope(), vaultId: '22222222-2222-4222-8222-222222222222' })]) {
    env.DB.sqlite.prepare('UPDATE financial_vaults SET envelope = ?').run(value);
    const response = await request(env, 'GET', undefined, auth);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Finance unavailable' });
  }
  env.DB.sqlite.prepare('UPDATE financial_vaults SET envelope = ?, revision = 1.5').run(original);
  assert.equal((await request(env, 'GET', undefined, auth)).status, 500);
});
