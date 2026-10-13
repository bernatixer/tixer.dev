export const MAX_ENVELOPE_BYTES = 512 * 1024;
export const MAX_PLAINTEXT_BYTES = 256 * 1024;

export type EncryptedPart = { nonce: string; ciphertext: string };
export type VaultEnvelope = {
  version: 1;
  vaultId: string;
  cipher: 'AES-256-GCM';
  kdf: {
    name: 'argon2id'; version: 19; memoryKiB: 65536;
    iterations: 3; parallelism: 1; hashLength: 32; salt: string;
  };
  passwordWrap: EncryptedPart;
  recoveryWrap: EncryptedPart;
  payload: EncryptedPart;
};

const encoder = new TextEncoder();
const invalid = () => new Error('Invalid encrypted vault envelope.');

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const actual = Object.keys(value);
  if (actual.length !== keys.length || !keys.every(key => Object.prototype.hasOwnProperty.call(value, key))) throw invalid();
  return value as Record<string, unknown>;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

function base64(value: unknown, minBytes: number, maxBytes = minBytes): string {
  if (typeof value !== 'string' || value.length > Math.ceil(maxBytes / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw invalid();
  const bytes = decodeBase64(value);
  if (bytes.length < minBytes || bytes.length > maxBytes || encodeBase64(bytes) !== value) throw invalid();
  return value;
}

function part(value: unknown, minBytes: number, maxBytes = minBytes): EncryptedPart {
  const fields = object(value, ['nonce', 'ciphertext']);
  return { nonce: base64(fields.nonce, 12), ciphertext: base64(fields.ciphertext, minBytes, maxBytes) };
}

export function parseEnvelope(input: unknown): VaultEnvelope {
  const fields = object(input, ['version', 'vaultId', 'cipher', 'kdf', 'passwordWrap', 'recoveryWrap', 'payload']);
  if (fields.version !== 1) throw new Error('Unsupported encrypted vault version.');
  if (fields.cipher !== 'AES-256-GCM' || typeof fields.vaultId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(fields.vaultId)) throw invalid();
  const kdf = object(fields.kdf, ['name', 'version', 'memoryKiB', 'iterations', 'parallelism', 'hashLength', 'salt']);
  // boffin: refuse altered work factors before a password can reach Argon2.
  if (kdf.name !== 'argon2id' || kdf.version !== 19 || kdf.memoryKiB !== 65536 ||
      kdf.iterations !== 3 || kdf.parallelism !== 1 || kdf.hashLength !== 32) throw invalid();
  const envelope: VaultEnvelope = {
    version: 1, vaultId: fields.vaultId, cipher: 'AES-256-GCM',
    kdf: {
      name: 'argon2id', version: 19, memoryKiB: 65536, iterations: 3,
      parallelism: 1, hashLength: 32, salt: base64(kdf.salt, 16),
    },
    passwordWrap: part(fields.passwordWrap, 48), recoveryWrap: part(fields.recoveryWrap, 48),
    payload: part(fields.payload, 16, MAX_PLAINTEXT_BYTES + 16),
  };
  if (encoder.encode(JSON.stringify(envelope)).byteLength > MAX_ENVELOPE_BYTES) throw invalid();
  return envelope;
}

export function parseBackup(text: string): VaultEnvelope {
  if (typeof text !== 'string' || text.length > MAX_ENVELOPE_BYTES ||
      encoder.encode(text).byteLength > MAX_ENVELOPE_BYTES) throw invalid();
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw invalid(); }
  return parseEnvelope(value);
}

export function exportBackup(envelope: VaultEnvelope): string {
  return JSON.stringify(parseEnvelope(envelope));
}
