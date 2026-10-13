import { argon2id } from 'hash-wasm'

self.onmessage = async ({ data }: MessageEvent<{ password: Uint8Array; salt: Uint8Array }>) => {
  try {
    const key = await argon2id({ password: data.password, salt: data.salt,
      memorySize: 65536, iterations: 3, parallelism: 1, hashLength: 32, outputType: 'binary' })
    self.postMessage({ key }, { transfer: [key.buffer] })
  } catch {
    self.postMessage({ error: true })
  } finally {
    data.password.fill(0)
    data.salt.fill(0)
    self.close()
  }
}
