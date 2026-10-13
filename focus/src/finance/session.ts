import { encryptVault, unlockVault, recoverVault, changePassphrase } from './crypto.ts'
import { parseEnvelope, parseBackup, exportBackup, type VaultEnvelope } from './envelope.ts'
import { migrateFinanceData, validateFinanceData, type FinanceData } from './model.ts'

export interface StoredVault { envelope: VaultEnvelope; revision: number; updatedAt: string }
export interface UnlockedVault { data: FinanceData; key: CryptoKey; envelope: VaultEnvelope; dirty: boolean }
export interface VaultState {
  status: 'loading' | 'error' | 'absent' | 'locked' | 'unlocked'
  record: StoredVault | null
  session: UnlockedVault | null
  busy: boolean
  saving: boolean
  saveError: boolean
  conflict: boolean
  message: string
}

export class VaultRequestError extends Error {
  status: number
  constructor(status: number) { super(status === 409 ? 'Another session changed this vault. Your unsaved edits are still here. Export them before loading the server copy.' : status === 401 ? 'Your login expired. Sign in again to save.' : 'The vault service could not complete this request. Your edits have not been marked saved.'); this.status = status }
}

export class VaultStore {
  state: VaultState = { status: 'loading', record: null, session: null, busy: false, saving: false, saveError: false, conflict: false, message: '' }
  private epoch = 0
  private controller = new AbortController()
  private getToken: () => Promise<string | null>
  private fetcher: typeof fetch
  onChange: () => void = () => {}

  constructor(getToken: () => Promise<string | null>, fetcher: typeof fetch = (...args) => fetch(...args)) {
    this.getToken = getToken
    this.fetcher = fetcher
  }
  get generation() { return this.epoch }
  get signal() { return this.controller.signal }
  private invalidate() {
    this.controller.abort()
    this.controller = new AbortController()
    return ++this.epoch
  }
  private assertCurrent(epoch: number) {
    if (epoch !== this.epoch) throw new DOMException('Vault operation is no longer active.', 'AbortError')
  }
  private emit(patch: Partial<VaultState>) { this.state = { ...this.state, ...patch }; this.onChange() }
  private async request(method: string, epoch: number, body?: unknown): Promise<StoredVault | null> {
    this.assertCurrent(epoch)
    const signal = this.signal
    const token = await this.getToken()
    // boffin: refuse a token obtained after lock or account departure before sending a mutation.
    this.assertCurrent(epoch)
    if (!token) throw new VaultRequestError(401)
    const response = await this.fetcher(`${import.meta.env?.VITE_API_URL || 'http://localhost:5555/api'}/finance/vault`, {
      method, signal, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    this.assertCurrent(epoch)
    if (method === 'GET' && response.status === 404) return null
    if (!response.ok) throw new VaultRequestError(response.status)
    if (method === 'DELETE' && response.status === 204) return null
    const putStatus = (body as { expectedRevision?: number } | undefined)?.expectedRevision === 0 ? 201 : 200
    if ((method === 'GET' && response.status !== 200) ||
      (method === 'PUT' && response.status !== putStatus) || method === 'DELETE') throw new Error('Invalid vault response')
    const value: unknown = await response.json()
    this.assertCurrent(epoch)
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== 3 || !['envelope', 'revision', 'updatedAt'].every(key => Object.prototype.hasOwnProperty.call(value, key))) throw new Error('Invalid vault response')
    const record = value as StoredVault
    if (!Number.isSafeInteger(record.revision) || record.revision < 1 || typeof record.updatedAt !== 'string' ||
      new Date(record.updatedAt).toISOString() !== record.updatedAt) throw new Error('Invalid vault response')
    return { revision: record.revision, updatedAt: record.updatedAt, envelope: parseEnvelope(record.envelope) }
  }
  async load() {
    const epoch = this.invalidate()
    this.emit({ status: 'loading', session: null, busy: true, saving: false, message: '' })
    try {
      const record = await this.request('GET', epoch)
      if (epoch === this.epoch) this.emit({ record, status: record ? 'locked' : 'absent', conflict: false, saveError: false })
    } catch (error) {
      if (epoch === this.epoch) this.emit({ status: 'error', message: this.errorMessage(error) })
    } finally { if (epoch === this.epoch) this.emit({ busy: false }) }
  }
  private errorMessage(error: unknown) {
    return error instanceof VaultRequestError ? error.message : 'Unable to read or unlock this vault. Check your secret or backup and retry. Existing data has been kept.'
  }
  async run(action: (epoch: number) => Promise<void>, saving = false) {
    if (this.state.busy) return
    const epoch = this.epoch
    this.emit({ busy: true, saving, message: this.state.saveError || this.state.conflict ? this.state.message : '' })
    try { await action(epoch) } catch (error) {
      // boffin: keep conflict recovery available after editing or exporting local changes.
      if (epoch === this.epoch) this.emit({ message: saving && !(error instanceof VaultRequestError)
        ? 'Changes could not be saved. Your edits remain in this unlocked page. Retry or export an encrypted copy.'
        : this.errorMessage(error), saveError: this.state.saveError || saving,
        conflict: this.state.conflict || (error instanceof VaultRequestError && error.status === 409) })
    } finally { if (epoch === this.epoch) this.emit({ busy: false, saving: false }) }
  }
  async unlock(passphrase: string) {
    await this.run(async () => {
      if (!this.state.record) { await this.load(); return }
      const epoch = this.epoch
      const { envelope } = this.state.record
      const { data, key } = await unlockVault(envelope, passphrase, this.signal)
      this.assertCurrent(epoch)
      const validated = migrateFinanceData(data)
      // boffin: late decryptions cannot reopen a locked or departed vault.
      const migrated = JSON.stringify(validated) !== JSON.stringify(data)
      if (epoch === this.epoch) this.emit({ status: 'unlocked', session: { data: validated, key, envelope, dirty: migrated }, message: migrated ? 'Vault upgraded locally. Save encrypted changes to keep the new format.' : '' })
    })
  }
  update(data: FinanceData) {
    if (this.state.session && (!this.state.busy || this.state.saving)) this.emit({ session: { ...this.state.session, data, dirty: true }, message: this.state.saveError || this.state.conflict ? this.state.message : '' })
  }
  async install(envelope: VaultEnvelope, key: CryptoKey, data: FinanceData, epoch: number) {
    if (epoch !== this.epoch) return
    validateFinanceData(data)
    const validatedEnvelope = parseEnvelope(envelope)
    const expectedRevision = this.state.record?.revision ?? 0
    let record: StoredVault | null
    try {
      record = await this.request('PUT', epoch, { expectedRevision,
        expectedVaultId: this.state.record?.envelope.vaultId ?? null, envelope: validatedEnvelope })
      this.assertCurrent(epoch)
      if (!record || record.revision <= expectedRevision ||
        JSON.stringify(record.envelope) !== JSON.stringify(validatedEnvelope)) throw new Error('Invalid vault response')
    } catch (error) {
      // boffin: pause autosave after failed credential writes as well as failed plan saves.
      if (epoch === this.epoch) this.emit({ saveError: true })
      throw error
    }
    // boffin: acknowledge the saved snapshot without discarding edits made while it was in flight.
    const latestData = this.state.saving && this.state.session ? this.state.session.data : data
    this.emit({ record, status: 'unlocked', session: { data: latestData, key, envelope: record.envelope, dirty: latestData !== data },
      conflict: false, saveError: false, message: 'Encrypted vault saved.' })
  }
  async save() {
    if (!this.state.session || this.state.conflict) return
    await this.run(async () => {
      const session = this.state.session
      if (!session) return
      const epoch = this.epoch
      validateFinanceData(session.data)
      const envelope = await encryptVault(session.data, session.key, session.envelope)
      await this.install(envelope, session.key, session.data, epoch)
    }, true)
  }
  async importBackup(text: string, secret: string, epoch: number, newPassphrase?: string) {
    this.assertCurrent(epoch)
    const envelope = parseBackup(text)
    // boffin: keep recovered backup changes local until explicit replacement.
    const unlocked = newPassphrase === undefined
      ? { envelope, ...await unlockVault(envelope, secret, this.signal) }
      : await recoverVault(envelope, secret, newPassphrase, this.signal)
    this.assertCurrent(epoch)
    const validated = migrateFinanceData(unlocked.data)
    const encrypted = await encryptVault(validated, unlocked.key, unlocked.envelope)
    this.assertCurrent(epoch)
    return { envelope: encrypted, key: unlocked.key, data: validated }
  }
  async recover(secret: string, passphrase: string) {
    await this.run(async () => {
      if (!this.state.record) return
      const epoch = this.epoch
      const result = await recoverVault(this.state.record.envelope, secret, passphrase, this.signal)
      this.assertCurrent(epoch)
      const data = migrateFinanceData(result.data)
      if (epoch !== this.epoch) return
      const envelope = await encryptVault(data, result.key, result.envelope)
      await this.install(envelope, result.key, data, epoch)
    })
  }
  async changePassword(passphrase: string) {
    await this.run(async () => {
      const session = this.state.session
      if (!session) return
      const epoch = this.epoch
      const rotated = await changePassphrase(session.envelope, session.key, passphrase, this.signal)
      this.assertCurrent(epoch)
      const envelope = await encryptVault(session.data, session.key, rotated)
      await this.install(envelope, session.key, session.data, epoch)
    })
  }
  async backup(): Promise<string> {
    const epoch = this.epoch
    const { session, record } = this.state
    if (session) {
      const envelope = await encryptVault(validateFinanceData(session.data), session.key, session.envelope)
      this.assertCurrent(epoch)
      return exportBackup(envelope)
    }
    if (record) return exportBackup(record.envelope)
    throw new Error('No vault to export')
  }
  async remove() {
    await this.run(async () => {
      if (!this.state.record) return
      const epoch = this.epoch
      await this.request('DELETE', epoch, { expectedRevision: this.state.record.revision, vaultId: this.state.record.envelope.vaultId })
      if (epoch === this.epoch) { this.lock(); this.emit({ status: 'absent', record: null, conflict: false, message: 'Encrypted vault deleted.' }) }
    })
  }
  lock() { this.invalidate(); this.emit({ session: null, status: this.state.status === 'absent' ? 'absent' : 'locked', busy: false, saving: false, saveError: false, message: '' }) }
  destroy() { this.onChange = () => {}; this.lock() }
}
