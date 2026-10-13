# Finance vault encryption, version 1

The browser encrypts one JSON document under a random 256-bit data encryption key (DEK). The worker stores only an opaque encrypted envelope. The crypto module has no storage, network, analytics or financial-model dependency. Its caller must validate decrypted data with `migrateFinanceData` before showing, replacing or saving a vault; unknown financial schema versions must remain errors, never empty plans.

Financial plaintext uses schema v3, independently of the v1 cryptographic envelope. Valid v1/v2 financial documents are validated in their original shape and upgraded after decryption; the next successful revision-checked save re-encrypts the validated v3 document under a fresh payload nonce. V1 snapshots gain unknown income. Existing portfolio contributions are preserved; new withdrawal totals are unknown and unconfirmed, never assumed zero. Migration does not change encryption, ownership or the API.

## Envelope and limits

`focus/src/finance/envelope.ts` validates the exact object keys and returns a detached copy. Unknown versions, ciphers, KDF profiles, extra fields, invalid UUIDs and noncanonical base64 are rejected before password derivation. `parseBackup` checks the raw UTF-8 file size before JSON parsing. Maximum envelope size is 512 KiB; maximum plaintext is 256 KiB, counting UTF-8 bytes and JSON syntax. Payload ciphertext includes a 16-byte authentication tag. All binary fields use canonical padded standard base64.

| Field | Required content |
| --- | --- |
| `version` | `1` |
| `vaultId` | Fresh lowercase UUIDv4 |
| `cipher` | `AES-256-GCM` |
| `kdf` | Exactly `{name:'argon2id', version:19, memoryKiB:65536, iterations:3, parallelism:1, hashLength:32, salt}` |
| `kdf.salt` | 16 random bytes |
| `passwordWrap`, `recoveryWrap` | Exactly `{nonce, ciphertext}`; 12-byte nonce, 48-byte ciphertext |
| `payload` | Exactly `{nonce, ciphertext}`; 12-byte nonce, 16–262160-byte ciphertext |

Encryption uses native Web Crypto AES-GCM with a 128-bit tag and a fresh CSPRNG 96-bit nonce on every operation. The exact authenticated context is UTF-8 JSON of `['focus-finance', version, vaultId, cipher, purpose]`, where purpose is `payload`, `password-wrap` or `recovery-wrap`. This binds ciphertext to its format, vault and role. Password rotation preserves the payload and recovery wrap, while generating a fresh password salt and wrap nonce. Recovery rotation preserves the payload and password wrap.

The password key comes from bundled `hash-wasm` 4.12.0 Argon2id v1.3: 65536 KiB memory, three passes, one lane, 32 output bytes. The memory and passes follow RFC 9106's lower-memory guidance; this application deliberately uses one lane rather than the RFC's four-lane recommended profile. Every accepted envelope has exactly this bounded profile. No device fallback lowers its cost. [RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html#section-4), [hash-wasm API and string normalization](https://github.com/Daninet/hash-wasm/tree/v4.12.0#hashing-passwords-with-argon2).

Passphrases use NFC normalization and UTF-8 encoding. Creation and password replacement require at least 12 Unicode code points after normalization. Input is limited to 1024 JavaScript string code units. Spaces and case are significant. The independent recovery secret is 32 random bytes, shown as eight groups of eight hexadecimal digits. Recovery accepts either case, spaces and hyphens. It imports the full random secret directly as an AES-256 wrapping key; it does not depend on the password KDF.

The DEK is extractable in browser memory because changing either credential requires wrapping the same key again. Raw DEK bytes exist only briefly while wrapping/unwrapping and are overwritten in `finally`; the password and recovery wrapping keys are nonextractable. `exportBackup` serializes only the validated envelope and excludes keys, passwords, plaintext and recovery secrets. The caller must keep all key objects and decrypted values in memory only.

## Public API

`crypto.ts` exports async operations:

| Function | Result |
| --- | --- |
| `createVault(data, passphrase, signal?)` | `{envelope, key, recoverySecret}` |
| `unlockVault(envelope, passphrase, signal?)` | `{data, key}` |
| `encryptVault(data, key, envelope)` | New envelope |
| `changePassphrase(envelope, key, passphrase, signal?)` | New envelope |
| `recoverVault(envelope, recoverySecret, passphrase, signal?)` | `{envelope, key, data}` |
| `rotateRecovery(envelope, key)` | `{envelope, recoverySecret}` |

`envelope.ts` exports `parseEnvelope(unknown)`, `parseBackup(string)` and `exportBackup(envelope)`. Operations never mutate the input envelope. Saves and credential rotation authenticate the old payload before using the supplied key, so a key from another vault cannot produce a corrupt replacement. An operation returns its complete result only after all decryptions/encryptions succeed. Errors contain no input values. Model validation and server compare-and-swap writes are separate caller responsibilities.

## Browser behavior and limits

Browser password derivation requires secure-context Web Crypto, WebAssembly and module Workers. It runs in a short-lived dedicated worker, which is terminated after a result, error, abort or 60-second timeout. The optional `AbortSignal` belongs to the caller's session lifecycle: abort it on lock, logout, account switch or departure. An abort immediately ends an active derivation worker and rejects with `AbortError`; the operation also checks cancellation before returning its result. `hash-wasm` internally holds WASM hash state; ending the worker releases the entire realm rather than keeping that state in the UI document. The main thread overwrites its own temporary password/derived-key byte arrays. The Node test path uses the same full Argon2id profile directly; it never substitutes fake crypto. Node's main-thread WASM work cannot be interrupted mid-computation, so only the browser worker provides immediate interruption.

Devices need more than 64 MiB of available memory because the page, WASM runtime and temporary buffers add overhead. Limited-memory devices or restrictive browser policies can fail derivation. The operation then fails explicitly and leaves existing ciphertext unchanged. Browser support is capability-based; no old-browser compatibility or low-memory fallback is supplied. [Web Crypto AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams).

JavaScript strings, garbage collection, native CryptoKeys and browser process memory cannot be reliably erased. Locking clears application-owned references and aborts password derivation; other in-flight Web Crypto operations cannot be interrupted and must also be invalidated by the caller's epoch so a late result cannot revive unlocked state. The crypto module itself never installs results into a session. This is no protection against compromised application JavaScript or a compromised device. Password changes, recovery resets and recovery-key rotation all preserve the data encryption key. Someone holding an old backup and its password or recovery secret can recover that key and decrypt future payloads from the same vault if they obtain later ciphertext, even after both credentials change. Combining the old envelope wraps with a later payload demonstrates this. These operations do not provide compromise recovery or revoke future access; a full rekey operation is not implemented. Old backups also remain readable. Authenticated encryption detects alteration but cannot distinguish a valid older envelope from the latest without trusted external state.

## Checks

Run with Node 24 or newer from `focus/`:

```sh
node --experimental-strip-types --test tests/crypto.test.ts
./node_modules/.bin/tsc --noEmit
```

The tests use real Argon2id and native Web Crypto. They cover serialized round trips; restoration in a fresh Node process; wrong password/recovery secret; tampered payload, wraps and vault identity; password and recovery rotation; old-backup access to later ciphertext after both credentials change; fresh nonces; wrong-key replacement prevention; exact plaintext byte limits; malformed/base64/unknown-version envelopes; bounded KDFs; NFC normalization; invalid JSON input; and pre-aborted/pending operations. A fixed encrypted fixture generated independently with Node's native `argon2Sync` and `createCipheriv` checks the exact work profile and authenticated context, so a symmetric weakening cannot pass through round-trip agreement. [Node native Argon2 API](https://nodejs.org/api/crypto.html#cryptoargon2syncalgorithm-parameters).

These Node checks do not establish real low-memory mobile performance or browser Worker loading. The parent integration checks must exercise the bundled browser module and report any unavailable browser/device coverage.
