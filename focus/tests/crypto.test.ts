import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  changePassphrase, createVault, encryptVault, recoverVault, rotateRecovery, unlockVault,
} from '../src/finance/crypto.ts';
import { exportBackup, parseBackup, parseEnvelope } from '../src/finance/envelope.ts';

const passphrase = 'A long private finance passphrase 2468';
const replacement = 'A different private passphrase 9753';
const data = { version: 1, currency: 'EUR', cash: 873421, note: 'Synthetic café savings' };
const altered = (value: string) => `${value[0] === 'A' ? 'B' : 'A'}${value.slice(1)}`;

test('real Argon2id and WebCrypto unlock a serialized vault without exporting secrets', async () => {
  const created = await createVault(data, passphrase);
  assert.deepEqual((await unlockVault(parseBackup(exportBackup(created.envelope)), passphrase)).data, data);
  const backup = exportBackup(created.envelope);
  assert.ok(!backup.includes('873421'));
  assert.ok(!backup.includes(passphrase));
  assert.ok(!backup.includes(created.recoverySecret));
  assert.equal(created.key.algorithm.name, 'AES-GCM');
  assert.equal((created.key.algorithm as AesKeyAlgorithm).length, 256);

  // A new process has neither the original CryptoKey nor a module-local vault cache.
  const restored = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
    `import { unlockVault } from './src/finance/crypto.ts';
     import { parseBackup } from './src/finance/envelope.ts';
     let input = ''; for await (const chunk of process.stdin) input += chunk;
     const { backup, passphrase } = JSON.parse(input);
     process.stdout.write(JSON.stringify((await unlockVault(parseBackup(backup), passphrase)).data));`,
  ], { cwd: new URL('..', import.meta.url), input: JSON.stringify({ backup, passphrase }), encoding: 'utf8' });
  assert.equal(restored.status, 0, restored.stderr);
  assert.deepEqual(JSON.parse(restored.stdout), data);
});

test('wrong password, altered wraps, payload and authenticated vault identity fail closed', async () => {
  const { envelope, recoverySecret } = await createVault(data, passphrase);
  await assert.rejects(unlockVault(envelope, 'A long incorrect password 0000'));
  for (const field of ['passwordWrap', 'payload'] as const) {
    const tampered = structuredClone(envelope);
    tampered[field].ciphertext = altered(tampered[field].ciphertext);
    await assert.rejects(unlockVault(tampered, passphrase));
  }
  const tamperedRecovery = structuredClone(envelope);
  tamperedRecovery.recoveryWrap.ciphertext = altered(tamperedRecovery.recoveryWrap.ciphertext);
  await assert.rejects(recoverVault(tamperedRecovery, recoverySecret, replacement));
  const changedId = { ...envelope, vaultId: '11111111-1111-4111-8111-111111111111' };
  await assert.rejects(unlockVault(changedId, passphrase));
  await assert.rejects(recoverVault(changedId, recoverySecret, replacement));
  const swapped = { ...envelope, passwordWrap: envelope.recoveryWrap, recoveryWrap: envelope.passwordWrap };
  await assert.rejects(unlockVault(swapped, passphrase));
  await assert.rejects(recoverVault(swapped, recoverySecret, replacement));
});

test('recovery resets password, password rotation preserves recovery, and recovery can rotate', async () => {
  const created = await createVault(data, passphrase);
  const original = exportBackup(created.envelope);
  const changed = await changePassphrase(created.envelope, created.key, replacement);
  assert.equal(exportBackup(created.envelope), original);
  assert.deepEqual(changed.payload, created.envelope.payload);
  assert.deepEqual(changed.recoveryWrap, created.envelope.recoveryWrap);
  assert.notEqual(changed.kdf.salt, created.envelope.kdf.salt);
  assert.notEqual(changed.passwordWrap.nonce, created.envelope.passwordWrap.nonce);
  await assert.rejects(unlockVault(changed, passphrase));
  assert.deepEqual((await unlockVault(changed, replacement)).data, data);
  const recovered = await recoverVault(changed, created.recoverySecret.toUpperCase().replaceAll('-', ' '), passphrase);
  assert.deepEqual(recovered.data, data);
  assert.deepEqual((await unlockVault(recovered.envelope, passphrase)).data, data);
  const rotated = await rotateRecovery(recovered.envelope, recovered.key);
  assert.notEqual(rotated.recoverySecret, created.recoverySecret);
  assert.notEqual(rotated.envelope.recoveryWrap.nonce, recovered.envelope.recoveryWrap.nonce);
  await assert.rejects(recoverVault(rotated.envelope, created.recoverySecret, replacement));
  assert.deepEqual((await recoverVault(rotated.envelope, rotated.recoverySecret, replacement)).data, data);
  // Rotation does not revoke backups which have already left the browser.
  assert.deepEqual((await recoverVault(parseBackup(original), created.recoverySecret, replacement)).data, data);
});

test('each payload save uses a new nonce and preserves the input on failure', async () => {
  const created = await createVault(data, passphrase);
  const original = exportBackup(created.envelope);
  const updatedData = { ...data, cash: 123456 };
  const first = await encryptVault(updatedData, created.key, created.envelope);
  const second = await encryptVault(updatedData, created.key, first);
  assert.notEqual(first.payload.nonce, created.envelope.payload.nonce);
  assert.notEqual(second.payload.nonce, first.payload.nonce);
  assert.notEqual(first.payload.ciphertext, second.payload.ciphertext);
  assert.equal(exportBackup(created.envelope), original);
  assert.deepEqual((await unlockVault(second, passphrase)).data, updatedData);
  await assert.rejects(encryptVault({ note: '€'.repeat(100000) }, created.key, created.envelope));
  assert.equal(exportBackup(created.envelope), original);
});

test('envelope parser rejects malformed encodings, unknown fields/versions and unbounded KDFs', async () => {
  const { envelope } = await createVault(data, passphrase);
  const invalid = [
    null, [], {}, { ...envelope, version: 2 }, { ...envelope, extra: 'plaintext' },
    { ...envelope, vaultId: 'other' }, { ...envelope, cipher: 'AES-CBC' },
    { ...envelope, kdf: { ...envelope.kdf, memoryKiB: 1 } },
    { ...envelope, kdf: { ...envelope.kdf, memoryKiB: 2 ** 31 } },
    { ...envelope, kdf: { ...envelope.kdf, iterations: 1 } },
    { ...envelope, kdf: { ...envelope.kdf, parallelism: 4 } },
    { ...envelope, kdf: { ...envelope.kdf, hashLength: 64 } },
    { ...envelope, kdf: { ...envelope.kdf, version: 16 } },
    { ...envelope, kdf: { ...envelope.kdf, salt: 'AA==' } },
    { ...envelope, kdf: { ...envelope.kdf, extra: true } },
    { ...envelope, payload: { ...envelope.payload, nonce: envelope.payload.nonce + '=' } },
    { ...envelope, passwordWrap: { ...envelope.passwordWrap, ciphertext: 'not base64' } },
    { ...envelope, recoveryWrap: { ...envelope.recoveryWrap, extra: null } },
    { ...envelope, payload: { ...envelope.payload, ciphertext: 'A'.repeat(350000) } },
  ];
  for (const value of invalid) assert.throws(() => parseEnvelope(value));
  const noncanonical = structuredClone(envelope);
  // Sixteen zero bytes end in AA==; AB== decodes identically but is not canonical.
  noncanonical.kdf.salt = 'AAAAAAAAAAAAAAAAAAAAAB==';
  assert.throws(() => parseEnvelope(noncanonical));
  assert.throws(() => parseBackup('not json'));
  assert.throws(() => parseBackup(' '.repeat(512 * 1024 + 1)));
  await assert.rejects(unlockVault({ ...envelope, version: 2 }, passphrase));
  await assert.rejects(unlockVault(invalid[7], passphrase));
});

test('passphrases normalize NFC, enforce creation minimum and bound input length', async () => {
  const created = await createVault(data, 'Some cafe\u0301 private passphrase 55');
  assert.deepEqual((await unlockVault(created.envelope, 'Some café private passphrase 55')).data, data);
  await assert.rejects(createVault(data, 'too short'));
  await assert.rejects(createVault(data, 'x'.repeat(1025)));
  await assert.rejects(changePassphrase(created.envelope, created.key, 'too short'));
  await assert.rejects(recoverVault(created.envelope, 'bad key', passphrase));
  await assert.rejects(recoverVault(created.envelope, '0'.repeat(64), passphrase));
  await assert.rejects(createVault({ note: 'x'.repeat(256 * 1024) }, passphrase));
  await assert.rejects(createVault(undefined, passphrase));
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  await assert.rejects(createVault(cyclic, passphrase));
});

test('a key from another vault cannot replace the payload or either credential wrap', async () => {
  const created = await createVault(data, passphrase);
  const other = await createVault(data, passphrase);
  const original = exportBackup(created.envelope);
  await assert.rejects(encryptVault({ ...data, cash: 1 }, other.key, created.envelope));
  await assert.rejects(changePassphrase(created.envelope, other.key, replacement));
  await assert.rejects(rotateRecovery(created.envelope, other.key));
  assert.equal(exportBackup(created.envelope), original);
  const tampered = structuredClone(created.envelope);
  tampered.payload.ciphertext = altered(tampered.payload.ciphertext);
  await assert.rejects(changePassphrase(tampered, created.key, replacement));
  await assert.rejects(rotateRecovery(tampered, created.key));
});

test('the 256 KiB plaintext boundary applies to encoded bytes, including JSON syntax', async () => {
  const boundary = 'x'.repeat(256 * 1024 - 2);
  const created = await createVault(boundary, passphrase);
  assert.equal((await unlockVault(created.envelope, passphrase)).data, boundary);
  await assert.rejects(encryptVault(boundary + 'x', created.key, created.envelope));
  assert.deepEqual((await unlockVault(created.envelope, passphrase)).data, boundary);
});

test('a fixture from independent native Argon2id/AES verifies the exact work profile and AAD', async () => {
  // Generated using Node 24.19 argon2Sync/createCipheriv, without hash-wasm or vault helpers.
  const fixture = JSON.parse(await readFile(new URL('./crypto-fixture.json', import.meta.url), 'utf8'));
  const envelope = parseEnvelope(fixture.envelope);
  assert.deepEqual((await unlockVault(envelope, fixture.passphrase)).data, fixture.expected);
  assert.deepEqual((await recoverVault(envelope, fixture.recoverySecret, replacement)).data, fixture.expected);
});

test('aborted operations never return decrypted data or replacement credentials', async () => {
  const created = await createVault(data, passphrase);
  const original = exportBackup(created.envelope);
  const controller = new AbortController();
  controller.abort();
  const aborted = (error: unknown) => error instanceof Error && error.name === 'AbortError';
  await assert.rejects(createVault(data, passphrase, controller.signal), aborted);
  await assert.rejects(unlockVault(created.envelope, passphrase, controller.signal), aborted);
  await assert.rejects(changePassphrase(created.envelope, created.key, replacement, controller.signal), aborted);
  await assert.rejects(recoverVault(created.envelope, created.recoverySecret, replacement, controller.signal), aborted);
  const pendingController = new AbortController();
  const pending = unlockVault(created.envelope, passphrase, pendingController.signal);
  pendingController.abort();
  await assert.rejects(pending, aborted);
  assert.equal(exportBackup(created.envelope), original);
});
