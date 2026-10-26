import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { decodeJwt, exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { app } from '../src/index.ts';
import { database } from './sqlite.ts';
import { previewOwner } from './preview-variants.ts';

const selfCheck = process.argv.includes('--self-check');
// boffin: refused self-check writes to persistent preview data before opening storage.
if (selfCheck && process.env.FOCUS_PREVIEW_DB !== undefined && process.env.FOCUS_PREVIEW_DB !== ':memory:') {
  throw new Error('Self-check requires an in-memory database; unset FOCUS_PREVIEW_DB or use :memory:');
}

const { publicKey, privateKey } = await generateKeyPair('RS256');
const issuer = 'https://finance-test.clerk.accounts.dev';
const db = database(process.env.FOCUS_PREVIEW_DB);
const env = { DB: db, CLERK_PEM_PUBLIC_KEY: await exportSPKI(publicKey),
  CLERK_ISSUER_URL: issuer, CLERK_AUTHORIZED_PARTIES: 'http://localhost:3000',
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET, ZAI_API_KEY: '', OPENAI_API_KEY: process.env.OPENAI_API_KEY };
const port = Number(process.env.FINANCE_TEST_PORT ?? 5556);
let failNext = false;

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? '/', `http://localhost:${port}`);
    let response: Response;
    if (url.pathname.startsWith('/__test/')) {
      const headers = { 'cache-control': 'no-store', 'access-control-allow-origin': 'http://localhost:3000' };
      if (url.pathname === '/__test/token') {
        try {
          const owner = previewOwner(db, url.searchParams.get('variant'));
          const now = Math.floor(Date.now() / 1000);
          const token = await new SignJWT({ iss: issuer, sub: owner, sid: 'synthetic_browser_session',
            azp: 'http://localhost:3000', nbf: now - 2, exp: now + 3600 })
            .setProtectedHeader({ alg: 'RS256' }).sign(privateKey);
          response = Response.json({ token }, { headers });
        } catch (error) {
          if (!(error instanceof RangeError)) throw error;
          response = Response.json({ error: 'Invalid preview variant' }, { status: 400, headers });
        }
      } else if (url.pathname === '/__test/inspect') {
        response = Response.json(db.sqlite.prepare('SELECT * FROM financial_vaults').all(), { headers });
      } else if (url.pathname === '/__test/fail-next' && incoming.method === 'POST') {
        failNext = true;
        response = Response.json({ ready: true }, { headers });
      } else if (url.pathname === '/__test/reset' && incoming.method === 'POST') {
        db.sqlite.exec('DELETE FROM financial_vaults');
        failNext = false;
        response = Response.json({ reset: true }, { headers });
      } else {
        response = new Response(null, { status: 404, headers });
      }
    } else if (failNext && incoming.method === 'PUT' && url.pathname === '/api/finance/vault') {
      failNext = false;
      response = Response.json({ error: 'Finance unavailable' }, { status: 500,
        headers: { 'cache-control': 'no-store', 'access-control-allow-origin': 'http://localhost:3000' } });
    } else {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(',') : value);
      }
      const request = new Request(url, { method: incoming.method, headers,
        ...(incoming.method === 'GET' || incoming.method === 'HEAD' ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }),
      } as RequestInit);
      response = await app.fetch(request, env as never);
    }
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(new Uint8Array(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { 'cache-control': 'no-store', 'content-type': 'application/json' });
    outgoing.end('{"error":"Test server unavailable"}');
  }
});

await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});

function close() {
  server.close(() => { db.sqlite.close(); });
}
process.once('SIGINT', close);
process.once('SIGTERM', close);

if (selfCheck) {
  try {
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(`${base}/api/finance/vault`)).status, 401);
    const { token } = await (await fetch(`${base}/__test/token`)).json();
    const absent = await fetch(`${base}/api/finance/vault`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(absent.status, 404);
    assert.equal(absent.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await (await fetch(`${base}/__test/inspect`)).json(), []);
    const base64 = (bytes: number) => Buffer.alloc(bytes).toString('base64');
    const envelope = {
      version: 1, vaultId: '11111111-1111-4111-8111-111111111111', cipher: 'AES-256-GCM',
      kdf: { name: 'argon2id', version: 19, memoryKiB: 65536, iterations: 3,
        parallelism: 1, hashLength: 32, salt: base64(16) },
      passwordWrap: { nonce: base64(12), ciphertext: base64(48) },
      recoveryWrap: { nonce: base64(12), ciphertext: base64(48) },
      payload: { nonce: base64(12), ciphertext: base64(32) },
    };
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const created = await fetch(`${base}/api/finance/vault`, { method: 'PUT', headers,
      body: JSON.stringify({ expectedRevision: 0, expectedVaultId: null, envelope }) });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).revision, 1);
    await fetch(`${base}/__test/fail-next`, { method: 'POST' });
    assert.equal((await fetch(`${base}/api/finance/vault`, { method: 'PUT', headers,
      body: JSON.stringify({ expectedRevision: 1, expectedVaultId: envelope.vaultId, envelope }) })).status, 500);
    assert.equal((await fetch(`${base}/api/finance/vault`, { method: 'DELETE', headers,
      body: JSON.stringify({ expectedRevision: 1, vaultId: envelope.vaultId }) })).status, 204);
    const rows = await (await fetch(`${base}/__test/inspect`)).json();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].envelope, null);
    assert.equal(rows[0].revision, 2);
    for (const variant of ['', 'unknown', '../synthetic_browser_user']) {
      assert.equal((await fetch(`${base}/__test/token?variant=${encodeURIComponent(variant)}`)).status, 400);
    }
    const originalHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    assert.equal((await fetch(`${base}/api/weight/entries/2020-01-01`, { method: 'PUT', headers: originalHeaders, body: JSON.stringify({ weightKg: 80 }) })).status, 200);
    const owners = new Set();
    for (const variant of ['north-star', 'goal-phases', 'checkpoints', 'calorie-target', 'reality-forecast']) {
      const response = await fetch(`${base}/__test/token?variant=${variant}`);
      assert.equal(response.status, 200);
      const variantToken = (await response.json()).token;
      const owner = decodeJwt(variantToken).sub;
      assert.notEqual(owner, decodeJwt(token).sub);
      owners.add(owner);
      const variantHeaders = { authorization: `Bearer ${variantToken}`, 'content-type': 'application/json' };
      assert.deepEqual((await (await fetch(`${base}/api/weight`, { headers: variantHeaders })).json()).entries, [{ date: '2020-01-01', weightKg: 80 }]);
      assert.equal((await fetch(`${base}/api/weight/entries/2020-01-01`, { method: 'PUT', headers: variantHeaders, body: JSON.stringify({ weightKg: 70 }) })).status, 200);
      await fetch(`${base}/__test/token?variant=${variant}`);
      assert.deepEqual((await (await fetch(`${base}/api/weight`, { headers: variantHeaders })).json()).entries, [{ date: '2020-01-01', weightKg: 70 }]);
    }
    assert.equal(owners.size, 5);
    assert.deepEqual((await (await fetch(`${base}/api/weight`, { headers: originalHeaders })).json()).entries, [{ date: '2020-01-01', weightKg: 80 }]);
    console.log('Finance and isolated Weight variant API self-check passed.');
  } finally { close(); }
} else {
  console.log(`Local test API listening at http://127.0.0.1:${port}`);
}
