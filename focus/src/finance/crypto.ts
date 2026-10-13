import {
  decodeBase64, encodeBase64, MAX_PLAINTEXT_BYTES, parseEnvelope,
} from './envelope.ts';
import type { EncryptedPart, VaultEnvelope } from './envelope.ts';

const encoder = new TextEncoder();
type Purpose = 'payload' | 'password-wrap' | 'recovery-wrap';
type Identity = Pick<VaultEnvelope, 'version' | 'vaultId' | 'cipher'>;

const aborted = () => new DOMException('Vault operation cancelled.', 'AbortError');

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw aborted();
}

function webCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error('Vault encryption needs a secure browser with Web Crypto.');
  return globalThis.crypto;
}

function random(length: number): Uint8Array<ArrayBuffer> {
  return webCrypto().getRandomValues(new Uint8Array(length));
}

function normalizePassphrase(value: string, creating = false): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || value.length > 1024) throw new Error('Passphrase must be at most 1024 characters.');
  const normalized = value.normalize('NFC');
  if (!normalized || (creating && [...normalized].length < 12)) {
    throw new Error('Choose a passphrase of at least 12 characters.');
  }
  return encoder.encode(normalized);
}

function recoveryBytes(secret: string): Uint8Array<ArrayBuffer> {
  if (typeof secret !== 'string' || secret.length > 128) throw new Error('Invalid recovery key.');
  const hex = secret.replace(/[\s-]/g, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hex)) throw new Error('Invalid recovery key.');
  return Uint8Array.from(hex.match(/../g)!, pair => Number.parseInt(pair, 16));
}

function formatRecovery(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').match(/.{8}/g)!.join('-');
}

function importAes(bytes: Uint8Array<ArrayBuffer>, extractable = false): Promise<CryptoKey> {
  return webCrypto().subtle.importKey('raw', bytes, 'AES-GCM', extractable, ['encrypt', 'decrypt']);
}

async function derivePasswordKey(password: Uint8Array<ArrayBuffer>, salt: string, signal?: AbortSignal): Promise<CryptoKey> {
  let derived: Uint8Array<ArrayBuffer> | undefined;
  try {
    assertActive(signal);
    if (typeof window === 'undefined') {
      const { argon2id } = await import('hash-wasm');
      assertActive(signal);
      const output = await argon2id({
        password, salt: decodeBase64(salt), memorySize: 65536, iterations: 3,
        parallelism: 1, hashLength: 32, outputType: 'binary',
      });
      derived = Uint8Array.from(output);
      output.fill(0);
    } else {
      if (typeof Worker === 'undefined') throw new Error('Workers unavailable');
      // boffin: keep password-bearing WASM state in a worker that dies on completion or cancellation.
      derived = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
        const worker = new Worker(new URL('./argon2.worker.ts', import.meta.url), { type: 'module' });
        const stop = () => {
          clearTimeout(timeout);
          worker.terminate();
          worker.onmessage = null;
          worker.onerror = null;
          worker.onmessageerror = null;
          signal?.removeEventListener('abort', abort);
        };
        const abort = () => { stop(); reject(aborted()); };
        const finish = (key?: Uint8Array<ArrayBuffer>) => {
          stop();
          if (key instanceof Uint8Array && key.length === 32) resolve(key);
          else reject(new Error('Argon2 failed'));
        };
        const timeout = setTimeout(() => finish(), 60000);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) { abort(); return; }
        worker.onmessage = event => finish(event.data?.key);
        worker.onerror = () => finish();
        worker.onmessageerror = () => finish();
        try { worker.postMessage({ password, salt: decodeBase64(salt) }); } catch { finish(); }
      });
    }
    assertActive(signal);
    const key = await importAes(derived);
    assertActive(signal);
    return key;
  } catch {
    assertActive(signal);
    throw new Error('Password derivation failed. This device must support 64 MiB Argon2id and Web Crypto.');
  } finally {
    password.fill(0);
    derived?.fill(0);
  }
}

function parameters(identity: Identity, purpose: Purpose, nonce: Uint8Array<ArrayBuffer>): AesGcmParams {
  return {
    name: 'AES-GCM', iv: nonce, tagLength: 128,
    additionalData: encoder.encode(JSON.stringify(['focus-finance', identity.version, identity.vaultId, identity.cipher, purpose])),
  };
}

async function seal(bytes: Uint8Array<ArrayBuffer>, key: CryptoKey, identity: Identity, purpose: Purpose): Promise<EncryptedPart> {
  const nonce = random(12);
  const ciphertext = await webCrypto().subtle.encrypt(parameters(identity, purpose, nonce), key, bytes);
  return { nonce: encodeBase64(nonce), ciphertext: encodeBase64(new Uint8Array(ciphertext)) };
}

async function open(part: EncryptedPart, key: CryptoKey, identity: Identity, purpose: Purpose): Promise<Uint8Array<ArrayBuffer>> {
  try {
    return new Uint8Array(await webCrypto().subtle.decrypt(
      parameters(identity, purpose, decodeBase64(part.nonce)), key, decodeBase64(part.ciphertext),
    ));
  } catch {
    throw new Error('Unable to unlock vault. Check your secret and the integrity of the backup.');
  }
}

function plaintext(data: unknown): Uint8Array<ArrayBuffer> {
  let text: string | undefined;
  try { text = JSON.stringify(data); } catch { throw new Error('Vault data must be valid JSON.'); }
  if (typeof text !== 'string') throw new Error('Vault data must be valid JSON.');
  const bytes = encoder.encode(text);
  if (bytes.byteLength > MAX_PLAINTEXT_BYTES) {
    bytes.fill(0);
    throw new Error('Vault data exceeds the 256 KiB limit.');
  }
  return bytes;
}

async function decryptData(envelope: VaultEnvelope, key: CryptoKey): Promise<unknown> {
  const bytes = await open(envelope.payload, key, envelope, 'payload');
  try {
    if (bytes.byteLength > MAX_PLAINTEXT_BYTES) throw new Error('Vault data exceeds the 256 KiB limit.');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('Decrypted vault data is not valid JSON.');
  } finally { bytes.fill(0); }
}

async function verifyKey(envelope: VaultEnvelope, key: CryptoKey): Promise<void> {
  const bytes = await open(envelope.payload, key, envelope, 'payload');
  bytes.fill(0);
}

async function unwrap(envelope: VaultEnvelope, wrappingKey: CryptoKey, purpose: 'password-wrap' | 'recovery-wrap'): Promise<CryptoKey> {
  const bytes = await open(purpose === 'password-wrap' ? envelope.passwordWrap : envelope.recoveryWrap, wrappingKey, envelope, purpose);
  try {
    if (bytes.byteLength !== 32) throw new Error('Invalid wrapped vault key.');
    return await importAes(bytes, true);
  } finally { bytes.fill(0); }
}

async function wrap(key: CryptoKey, wrappingKey: CryptoKey, identity: Identity, purpose: 'password-wrap' | 'recovery-wrap'): Promise<EncryptedPart> {
  const bytes = new Uint8Array(await webCrypto().subtle.exportKey('raw', key));
  try { return await seal(bytes, wrappingKey, identity, purpose); }
  finally { bytes.fill(0); }
}

export async function createVault(data: unknown, passphrase: string, signal?: AbortSignal): Promise<{
  envelope: VaultEnvelope; key: CryptoKey; recoverySecret: string;
}> {
  assertActive(signal);
  const bytes = plaintext(data);
  let password: Uint8Array<ArrayBuffer> | undefined;
  let recovery: Uint8Array<ArrayBuffer> | undefined;
  try {
    password = normalizePassphrase(passphrase, true);
    recovery = random(32);
    const identity: Identity = { version: 1, vaultId: webCrypto().randomUUID(), cipher: 'AES-256-GCM' };
    const salt = encodeBase64(random(16));
    const passwordKey = await derivePasswordKey(password, salt, signal);
    const recoveryKey = await importAes(recovery);
    const key = await webCrypto().subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const envelope = parseEnvelope({
      ...identity,
      kdf: { name: 'argon2id', version: 19, memoryKiB: 65536, iterations: 3, parallelism: 1, hashLength: 32, salt },
      passwordWrap: await wrap(key, passwordKey, identity, 'password-wrap'),
      recoveryWrap: await wrap(key, recoveryKey, identity, 'recovery-wrap'),
      payload: await seal(bytes, key, identity, 'payload'),
    });
    assertActive(signal);
    return { envelope, key, recoverySecret: formatRecovery(recovery) };
  } finally { password?.fill(0); bytes.fill(0); recovery?.fill(0); }
}

export async function unlockVault(input: unknown, passphrase: string, signal?: AbortSignal): Promise<{ data: unknown; key: CryptoKey }> {
  assertActive(signal);
  const envelope = parseEnvelope(input);
  const wrappingKey = await derivePasswordKey(normalizePassphrase(passphrase), envelope.kdf.salt, signal);
  const key = await unwrap(envelope, wrappingKey, 'password-wrap');
  const data = await decryptData(envelope, key);
  assertActive(signal);
  return { data, key };
}

export async function encryptVault(data: unknown, key: CryptoKey, input: VaultEnvelope): Promise<VaultEnvelope> {
  const envelope = parseEnvelope(input);
  // boffin: authenticate the old payload before allowing its key to replace vault data or wraps.
  await verifyKey(envelope, key);
  const bytes = plaintext(data);
  try { return parseEnvelope({ ...envelope, payload: await seal(bytes, key, envelope, 'payload') }); }
  finally { bytes.fill(0); }
}

export async function changePassphrase(input: VaultEnvelope, key: CryptoKey, newPassphrase: string, signal?: AbortSignal): Promise<VaultEnvelope> {
  assertActive(signal);
  const envelope = parseEnvelope(input);
  await verifyKey(envelope, key);
  const salt = encodeBase64(random(16));
  const wrappingKey = await derivePasswordKey(normalizePassphrase(newPassphrase, true), salt, signal);
  const changed = parseEnvelope({
    ...envelope, kdf: { ...envelope.kdf, salt },
    passwordWrap: await wrap(key, wrappingKey, envelope, 'password-wrap'),
  });
  assertActive(signal);
  return changed;
}

export async function recoverVault(input: unknown, recoverySecret: string, newPassphrase: string, signal?: AbortSignal): Promise<{
  envelope: VaultEnvelope; key: CryptoKey; data: unknown;
}> {
  assertActive(signal);
  const envelope = parseEnvelope(input);
  const bytes = recoveryBytes(recoverySecret);
  let wrappingKey: CryptoKey;
  try { wrappingKey = await importAes(bytes); } finally { bytes.fill(0); }
  const key = await unwrap(envelope, wrappingKey, 'recovery-wrap');
  const data = await decryptData(envelope, key);
  const changed = await changePassphrase(envelope, key, newPassphrase, signal);
  assertActive(signal);
  return { envelope: changed, key, data };
}

export async function rotateRecovery(input: VaultEnvelope, key: CryptoKey): Promise<{ envelope: VaultEnvelope; recoverySecret: string }> {
  const envelope = parseEnvelope(input);
  await verifyKey(envelope, key);
  const bytes = random(32);
  try {
    const wrappingKey = await importAes(bytes);
    const recoveryWrap = await wrap(key, wrappingKey, envelope, 'recovery-wrap');
    return { envelope: parseEnvelope({ ...envelope, recoveryWrap }), recoverySecret: formatRecovery(bytes) };
  } finally { bytes.fill(0); }
}
