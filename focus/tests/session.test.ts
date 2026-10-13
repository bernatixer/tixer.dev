import test from 'node:test'
import assert from 'node:assert/strict'
import { VaultStore } from '../src/finance/session.ts'
import { createDefaultFinanceData } from '../src/finance/model.ts'
import { createVault, encryptVault, recoverVault, rotateRecovery, unlockVault } from '../src/finance/crypto.ts'
import { exportBackup } from '../src/finance/envelope.ts'

const passphrase = 'session test passphrase'
const data = createDefaultFinanceData('2026-10-12')
const created = await createVault(data, passphrase)
const record = { envelope: created.envelope, revision: 1, updatedAt: '2026-10-12T00:00:00.000Z' }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

test('only 404 permits creation; authentication and network failures remain errors', async () => {
  for (const status of [204, 401, 403, 500]) {
    const store = new VaultStore(async () => 'token', async () => new Response(null, { status }))
    await store.load()
    assert.equal(store.state.status, 'error')
  }
  const absent = new VaultStore(async () => 'token', async () => new Response('', { status: 404 }))
  await absent.load()
  assert.equal(absent.state.status, 'absent')
  const offline = new VaultStore(async () => 'token', async () => { throw new TypeError('Offline') })
  await offline.load()
  assert.equal(offline.state.status, 'error')
})

test('late reads cannot restore state after locking', async () => {
  let resolve!: (r: Response) => void
  const store = new VaultStore(async () => 'token', () => new Promise(r => { resolve = r }))
  const pending = store.load()
  await new Promise(r => setTimeout(r, 0))
  store.lock()
  resolve(new Response('', { status: 404 }))
  await pending
  assert.equal(store.state.status, 'locked')
  assert.equal(store.state.session, null)
})

test('lock and destroy discard real decrypted data and unsaved references', () => {
  const store = new VaultStore(async () => 'token')
  store.state.session = { data, key: created.key, envelope: created.envelope, dirty: true }
  store.lock()
  assert.equal(store.state.session, null)
  store.destroy()
  assert.equal(store.state.session, null)
})

test('a pending token cannot send a mutation after locking', async () => {
  const token = deferred<string | null>()
  let mutations = 0
  const store = new VaultStore(() => token.promise, async () => {
    mutations++
    return Response.json(record, { status: 201 })
  })
  const pending = store.run(async epoch => store.install(created.envelope, created.key, data, epoch))
  await new Promise(resolve => setTimeout(resolve, 0))
  store.lock()
  token.resolve('new-account-token')
  await pending
  assert.equal(mutations, 0)
  assert.equal(store.state.session, null)
  assert.equal(store.state.status, 'locked')
})

test('an explicitly stale install cannot persist or reopen a vault', async () => {
  let mutations = 0
  const store = new VaultStore(async () => 'token', async () => {
    mutations++
    return Response.json(record, { status: 201 })
  })
  const generation = store.generation
  store.lock()
  await store.install(created.envelope, created.key, data, generation)
  assert.equal(mutations, 0)
  assert.equal(store.state.session, null)
})

test('save conflicts and failures preserve actual decrypted edits and their unsaved state', async () => {
  for (const status of [409, 500]) {
    let mutations = 0
    let sentEnvelope: unknown
    const store = new VaultStore(async () => 'token', async (_url, options) => {
      if (options?.method === 'GET') return Response.json(record)
      mutations++
      sentEnvelope = JSON.parse(String(options?.body)).envelope
      return new Response('', { status })
    })
    await store.load()
    await store.unlock(passphrase)
    const edited = { ...data, income: { ...data.income, regularAmount: 123456 } }
    store.update(edited)
    await store.save()
    assert.equal(mutations, 1)
    assert.equal(store.state.status, 'unlocked')
    assert.equal(store.state.session!.data.income.regularAmount, 123456)
    assert.equal(store.state.session!.dirty, true)
    assert.equal(store.state.conflict, status === 409)
    assert.deepEqual(store.state.record, record)
    assert.equal((await unlockVault(sentEnvelope, passphrase)).data.income.regularAmount, 123456)
  }
})

test('conflicts survive editing, exporting, locking, and failed loads until a successful load', async () => {
  let readStatus = 200
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'GET') return readStatus === 200 ? Response.json(record) : new Response(null, { status: readStatus })
    return new Response(null, { status: 409 })
  })
  await store.load()
  await store.unlock(passphrase)
  store.update({ ...data, currency: 'USD' })
  await store.save()
  assert.equal(store.state.conflict, true)
  store.update({ ...data, currency: 'GBP' })
  assert.match(store.state.message, /Another session changed this vault/)
  assert.equal(store.state.conflict, true)
  await store.run(async () => {
    const exported = await store.backup()
    assert.equal((await unlockVault(JSON.parse(exported), passphrase)).data.currency, 'GBP')
  })
  assert.equal(store.state.conflict, true)
  assert.equal(store.state.session!.dirty, true)
  store.lock()
  assert.equal(store.state.conflict, true)
  await store.unlock(passphrase)
  assert.equal(store.state.conflict, true)
  readStatus = 500
  await store.load()
  assert.equal(store.state.status, 'error')
  assert.equal(store.state.session, null)
  assert.equal(store.state.conflict, true)
  readStatus = 200
  await store.load()
  assert.equal(store.state.status, 'locked')
  assert.equal(store.state.conflict, false)
})

test('a latched conflict blocks later saves until reloading the server copy', async () => {
  let conflicting = true
  let writes = 0
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'GET') return Response.json(record)
    writes++
    if (conflicting) return new Response(null, { status: 409 })
    if (options?.method === 'DELETE') return new Response(null, { status: 204 })
    return Response.json({ ...record, envelope: JSON.parse(String(options?.body)).envelope, revision: 2 })
  })
  await store.load()
  await store.unlock(passphrase)
  store.update({ ...data, currency: 'USD' })
  await store.save()
  assert.equal(store.state.conflict, true)
  conflicting = false
  await store.save()
  assert.equal(writes, 1)
  assert.equal(store.state.conflict, true)
  assert.equal(store.state.session!.dirty, true)
  await store.load()
  await store.unlock(passphrase)
  store.update({ ...data, currency: 'GBP' })
  await store.save()
  assert.equal(store.state.conflict, false)
  assert.equal(store.state.session!.dirty, false)
  conflicting = true
  await store.remove()
  assert.equal(store.state.conflict, true)
  assert.equal(store.state.status, 'unlocked')
  conflicting = false
  await store.remove()
  assert.equal(store.state.conflict, false)
  assert.equal(store.state.status, 'absent')
})

test('save acknowledgements preserve later edits and serialize the next save on the new revision', async () => {
  const started = deferred<void>()
  const response = deferred<Response>()
  const sent: { expectedRevision: number; envelope: typeof created.envelope }[] = []
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'GET') return Response.json(record)
    sent.push(JSON.parse(String(options?.body)))
    if (sent.length === 1) { started.resolve(); return response.promise }
    return Response.json({ ...record, envelope: sent[1].envelope, revision: 3 })
  })
  await store.load()
  await store.unlock(passphrase)
  store.update({ ...data, currency: 'USD' })
  const saving = store.save()
  await started.promise
  store.update({ ...data, currency: 'GBP' })
  assert.equal(store.state.session!.data.currency, 'GBP')
  assert.equal(store.state.busy, true)
  assert.equal(store.state.saving, true)
  await store.save()
  assert.equal(sent.length, 1)
  response.resolve(Response.json({ ...record, envelope: sent[0].envelope, revision: 2 }))
  await saving
  assert.equal((await unlockVault(sent[0].envelope, passphrase)).data.currency, 'USD')
  assert.equal(store.state.session!.data.currency, 'GBP')
  assert.equal(store.state.session!.dirty, true)
  assert.equal(store.state.record!.revision, 2)
  assert.equal(store.state.busy, false)
  assert.equal(store.state.saving, false)
  await store.save()
  assert.equal(sent[1].expectedRevision, 2)
  assert.equal((await unlockVault(sent[1].envelope, passphrase)).data.currency, 'GBP')
  assert.equal(store.state.record!.revision, 3)
  assert.equal(store.state.session!.dirty, false)
})

test('failed saves retain the latest draft and latch the error through edits and export until explicit retry succeeds', async () => {
  const started = deferred<void>()
  const failed = deferred<void>()
  let writes = 0
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'GET') return Response.json(record)
    writes++
    if (writes === 1) { started.resolve(); await failed.promise; throw new TypeError('Offline') }
    const sent = JSON.parse(String(options?.body))
    assert.equal(sent.expectedRevision, 1)
    return Response.json({ ...record, envelope: sent.envelope, revision: 2 })
  })
  await store.load()
  await store.unlock(passphrase)
  store.update({ ...data, currency: 'USD' })
  const saving = store.save()
  await started.promise
  store.update({ ...data, currency: 'GBP' })
  failed.resolve()
  await saving
  assert.equal(store.state.session!.data.currency, 'GBP')
  assert.equal(store.state.session!.dirty, true)
  assert.equal(store.state.saveError, true)
  assert.equal(store.state.saving, false)
  assert.equal(store.state.busy, false)
  assert.equal(store.state.conflict, false)
  assert.equal(store.state.record!.revision, 1)
  const failureMessage = store.state.message
  store.update({ ...data, currency: 'CHF' })
  assert.equal(store.state.saveError, true)
  assert.equal(store.state.message, failureMessage)
  let exported = ''
  await store.run(async () => { exported = await store.backup() })
  assert.equal((await unlockVault(JSON.parse(exported), passphrase)).data.currency, 'CHF')
  assert.equal(store.state.saveError, true)
  assert.equal(store.state.message, failureMessage)
  assert.equal(writes, 1)
  await store.save()
  assert.equal(writes, 2)
  assert.equal(store.state.saveError, false)
  assert.equal(store.state.session!.dirty, false)
  assert.equal((await unlockVault(store.state.record!.envelope, passphrase)).data.currency, 'CHF')
})

test('failed credential persistence pauses autosave until an explicit action succeeds', async () => {
  const replacement = 'replacement session passphrase'
  let writes = 0
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'GET') return Response.json(record)
    writes++
    if (writes === 1) return new Response(null, { status: 500 })
    const sent = JSON.parse(String(options?.body))
    assert.equal(sent.expectedRevision, 1)
    return Response.json({ ...record, envelope: sent.envelope, revision: 2 })
  })
  await store.load()
  await store.unlock(passphrase)
  store.update({ ...data, currency: 'USD' })
  await store.changePassword(replacement)
  assert.equal(writes, 1)
  assert.equal(store.state.saveError, true)
  assert.equal(store.state.busy, false)
  assert.equal(store.state.session!.dirty, true)
  assert.deepEqual(store.state.record, record)
  const message = store.state.message
  store.update({ ...data, currency: 'GBP' })
  assert.equal(store.state.message, message)
  assert.equal(store.state.saveError, true)
  await assert.rejects(unlockVault(store.state.record!.envelope, replacement))
  await store.changePassword(replacement)
  assert.equal(writes, 2)
  assert.equal(store.state.saveError, false)
  assert.equal(store.state.session!.dirty, false)
  assert.equal((await unlockVault(store.state.record!.envelope, replacement)).data.currency, 'GBP')
  await assert.rejects(unlockVault(store.state.record!.envelope, passphrase))
})

test('a plan retry cannot acknowledge a failed password change', async () => {
  const replacement = 'replacement session passphrase'
  let stored = record
  let fail = true
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'GET') return Response.json(stored)
    if (fail) return new Response(null, { status: 500 })
    const sent = JSON.parse(String(options?.body))
    stored = { ...stored, envelope: sent.envelope, revision: stored.revision + 1 }
    return Response.json(stored)
  })
  await store.load()
  await store.unlock(passphrase)
  await store.changePassword(replacement)
  fail = false
  store.update({ ...data, currency: 'USD' })
  await store.save()
  assert.equal((await unlockVault(stored.envelope, passphrase)).data.currency, 'USD')
  await assert.rejects(unlockVault(stored.envelope, replacement))
  assert.deepEqual(store.state.credentialErrors, ['password'])
  assert.equal(store.state.saveError, false)
  await store.run(async () => { await store.backup() })
  assert.deepEqual(store.state.credentialErrors, ['password'])
  store.lock()
  await store.unlock(passphrase)
  assert.deepEqual(store.state.credentialErrors, ['password'])
  await store.changePassword(replacement)
  assert.deepEqual(store.state.credentialErrors, [])
  assert.deepEqual((await unlockVault(stored.envelope, replacement)).data, store.state.session!.data)
  await assert.rejects(unlockVault(stored.envelope, passphrase))
})

test('password and recovery failures are acknowledged independently', async () => {
  const replacement = 'replacement session passphrase'
  let stored = record
  let fail = true
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'GET') return Response.json(stored)
    if (fail) return new Response(null, { status: 500 })
    const sent = JSON.parse(String(options?.body))
    stored = { ...stored, envelope: sent.envelope, revision: stored.revision + 1 }
    return Response.json(stored)
  })
  await store.load()
  await store.unlock(passphrase)
  const rotated = await rotateRecovery(created.envelope, created.key)
  const saveRecovery = () => store.run(async epoch => {
    const session = store.state.session!
    const envelope = await encryptVault(session.data, session.key, { ...session.envelope, recoveryWrap: rotated.envelope.recoveryWrap })
    await store.install(envelope, session.key, session.data, epoch)
  }, 'recovery')
  await saveRecovery()
  await store.changePassword(replacement)
  assert.deepEqual(store.state.credentialErrors, ['recovery', 'password'])
  fail = false
  await store.changePassword(replacement)
  assert.deepEqual(store.state.credentialErrors, ['recovery'])
  await store.save()
  assert.deepEqual(store.state.credentialErrors, ['recovery'])
  await saveRecovery()
  assert.deepEqual(store.state.credentialErrors, [])
  assert.deepEqual((await recoverVault(stored.envelope, rotated.recoverySecret, replacement)).data, data)
  await assert.rejects(recoverVault(stored.envelope, created.recoverySecret, replacement))
})

test('dismissal only clears the selected warning and late credential failures cannot revive it after lock', async () => {
  const store = new VaultStore(async () => 'token', async () => Response.json(record))
  await store.load()
  await store.unlock(passphrase)
  for (const credential of ['password', 'recovery'] as const) {
    await store.run(async () => { throw new Error('Synthetic credential failure') }, credential)
  }
  store.dismissCredentialError('password')
  assert.deepEqual(store.state.credentialErrors, ['recovery'])
  assert.deepEqual(store.state.record, record)
  assert.equal(store.state.session!.envelope, store.state.record!.envelope)
  store.dismissCredentialError('recovery')
  const response = deferred<void>()
  const pending = store.run(async () => { await response.promise; throw new Error('Late failure') }, 'password')
  store.lock()
  response.resolve()
  await pending
  assert.deepEqual(store.state.credentialErrors, [])
  assert.equal(store.state.session, null)
})

test('edits remain blocked during security operations', async () => {
  const released = deferred<void>()
  const store = new VaultStore(async () => 'token', async () => Response.json(record))
  await store.load()
  await store.unlock(passphrase)
  const pending = store.run(async () => released.promise)
  store.update({ ...data, currency: 'USD' })
  assert.equal(store.state.session!.data.currency, data.currency)
  assert.equal(store.state.saving, false)
  released.resolve()
  await pending
})

test('lock preserves confirmed absence without inventing absence during loading or failure', async () => {
  for (const responseStatus of [404, 500]) {
    const store = new VaultStore(async () => 'token', async () => new Response(null, { status: responseStatus }))
    await store.load()
    store.lock()
    assert.equal(store.state.status, responseStatus === 404 ? 'absent' : 'locked')
    assert.equal(store.state.session, null)
  }
  const loading = new VaultStore(async () => 'token')
  loading.lock()
  assert.equal(loading.state.status, 'locked')
})

test('unsupported decrypted schemas cannot replace the locked record or trigger writes', async () => {
  const unsupported = await createVault({ ...data, version: 999 }, passphrase)
  const stored = { ...record, envelope: unsupported.envelope }
  let writes = 0
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method !== 'GET') writes++
    return Response.json(stored)
  })
  await store.load()
  await store.unlock(passphrase)
  assert.equal(store.state.status, 'locked')
  assert.equal(store.state.session, null)
  assert.deepEqual(store.state.record, stored)
  assert.equal(writes, 0)
  assert.match(store.state.message, /kept/)
})

for (const version of [1, 2]) test(`a real encrypted v${version} vault upgrades locally and re-encrypts only on a successful revision save`, async () => {
  const { annualRealGrowthPercent: _growth, ...income } = data.income
  const portfolio = { id: 'fund', label: 'Synthetic legacy fund', balance: 120000, observedOn: data.plan.asOf, equityPercent: null, bondPercent: null, totalContributions: 100000 }
  const observation = { id: 'fund', balance: 120000, observedOn: data.plan.asOf, totalContributions: 100000 }
  const legacy = { ...data, version, income: version === 1 ? income : data.income, portfolios: [portfolio], snapshots: [{ id: 'old', date: data.plan.asOf, cash: [], portfolios: [observation], debts: [], ...(version === 2 ? { incomeAnnual: null } : {}) }] }
  const old = await createVault(legacy, passphrase)
  let stored = { ...record, envelope: old.envelope }
  let writes = 0
  let fail = true
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'PUT') {
      writes++
      if (fail) return new Response(null, { status: 500 })
      const body = JSON.parse(String(options.body))
      assert.equal(body.expectedRevision, 1)
      stored = { ...stored, envelope: body.envelope, revision: 2 }
    }
    return Response.json(stored)
  })
  await store.load()
  await store.unlock(passphrase)
  assert.equal(writes, 0)
  assert.equal(store.state.session!.data.version, 3)
  assert.equal(store.state.session!.data.snapshots[0].incomeAnnual, null)
  assert.equal(store.state.session!.data.snapshots[0].portfolios[0].totalContributions, 100000)
  assert.equal(store.state.session!.data.snapshots[0].portfolios[0].totalWithdrawals, null)
  assert.equal(store.state.session!.data.portfolios[0].cashFlowsConfirmed, false)
  assert.equal(store.state.session!.dirty, true)
  await store.save()
  assert.equal(store.state.session!.dirty, true)
  assert.deepEqual((await unlockVault(stored.envelope, passphrase)).data, legacy)
  fail = false
  await store.save()
  assert.equal(store.state.session!.dirty, false)
  assert.deepEqual((await unlockVault(stored.envelope, passphrase)).data, store.state.session!.data)
  assert.notEqual(stored.envelope.payload.nonce, old.envelope.payload.nonce)
})

test('malformed server records never make a vault appear absent', async () => {
  for (const value of [null, {}, { ...record, revision: 0 }, { ...record, revision: 1.5 },
    { ...record, updatedAt: 'not-a-date' }, { ...record, extra: 'unexpected' }]) {
    const store = new VaultStore(async () => 'token', async () => Response.json(value))
    await store.load()
    assert.equal(store.state.status, 'error')
    assert.equal(store.state.session, null)
  }
})

test('an import started after its original operation was locked cannot decrypt or return a candidate', async () => {
  const store = new VaultStore(async () => 'token')
  const epoch = store.generation
  store.lock()
  await assert.rejects(store.importBackup(exportBackup(created.envelope), passphrase, epoch), { name: 'AbortError' })
  assert.equal(store.state.session, null)
})

test('locking aborts pending real decryption and discards late export results', async () => {
  const store = new VaultStore(async () => 'token', async () => Response.json(record))
  await store.load()
  const signal = store.signal
  const unlocking = store.unlock(passphrase)
  store.lock()
  await unlocking
  assert.equal(signal.aborted, true)
  assert.equal(store.state.status, 'locked')
  assert.equal(store.state.session, null)
  await store.unlock(passphrase)
  assert.equal(store.state.status, 'unlocked')
  const exporting = store.backup()
  store.lock()
  await assert.rejects(exporting, { name: 'AbortError' })
  assert.equal(store.state.session, null)
})

test('a late save response cannot restore decrypted state after locking', async () => {
  const started = deferred<void>()
  const response = deferred<Response>()
  let savedEnvelope: typeof created.envelope
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'GET') return Response.json(record)
    savedEnvelope = JSON.parse(String(options?.body)).envelope
    started.resolve()
    return response.promise
  })
  await store.load()
  await store.unlock(passphrase)
  store.update({ ...data, currency: 'USD' })
  const saving = store.save()
  await started.promise
  assert.equal(store.state.saving, true)
  store.lock()
  assert.equal(store.state.saving, false)
  assert.equal(store.state.saveError, false)
  response.resolve(Response.json({ ...record, envelope: savedEnvelope!, revision: 2 }))
  await saving
  assert.equal(store.state.status, 'locked')
  assert.equal(store.state.session, null)
  assert.deepEqual(store.state.record, record)
  assert.equal(store.state.busy, false)
  assert.equal(store.state.saving, false)
  assert.equal(store.state.saveError, false)
})

test('DELETE cannot use a token resolved after account departure', async () => {
  const laterToken = deferred<string | null>()
  let tokens = 0
  let mutations = 0
  const store = new VaultStore(() => ++tokens === 1 ? Promise.resolve('owner-token') : laterToken.promise,
    async (_url, options) => {
      if (options?.method === 'GET') return Response.json(record)
      mutations++
      return new Response(null, { status: 204 })
    })
  await store.load()
  const deleting = store.remove()
  store.lock()
  laterToken.resolve('different-owner-token')
  await deleting
  assert.equal(mutations, 0)
  assert.deepEqual(store.state.record, record)
  assert.equal(store.state.session, null)
})

test('unexpected save acknowledgements cannot mark local edits saved', async () => {
  for (const failure of ['stale-revision', 'different-envelope', 'wrong-status', 'empty']) {
    const store = new VaultStore(async () => 'token', async (_url, options) => {
      const sent = JSON.parse(String(options?.body))
      if (failure === 'empty') return new Response(null, { status: 204 })
      return Response.json({ ...record,
        envelope: failure === 'different-envelope' ? record.envelope : sent.envelope,
        revision: failure === 'stale-revision' ? 1 : 2,
      }, { status: failure === 'wrong-status' ? 201 : 200 })
    })
    store.state = { status: 'unlocked', record, session: {
      data, key: created.key, envelope: created.envelope, dirty: true,
    }, busy: false, saving: false, saveError: false, credentialErrors: [], conflict: false, message: '' }
    await store.save()
    assert.equal(store.state.session!.dirty, true, failure)
    assert.deepEqual(store.state.record, record)
  }
})

test('a fresh absent store restores a backup with its recovery secret and a new passphrase', async () => {
  const newPassphrase = 'fresh recovery import passphrase'
  let writes = 0
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'GET') return new Response(null, { status: 404 })
    writes++
    const sent = JSON.parse(String(options?.body))
    assert.equal(sent.expectedRevision, 0)
    assert.equal(sent.expectedVaultId, null)
    return Response.json({ ...record, envelope: sent.envelope }, { status: 201 })
  })
  await store.load()
  const epoch = store.generation
  const prepared = await store.importBackup(exportBackup(created.envelope), created.recoverySecret, epoch, newPassphrase)
  assert.equal(writes, 0)
  assert.equal(store.state.status, 'absent')
  assert.deepEqual(prepared.data, data)
  assert.deepEqual((await unlockVault(prepared.envelope, newPassphrase)).data, data)
  await assert.rejects(unlockVault(prepared.envelope, passphrase))
  await store.install(prepared.envelope, prepared.key, prepared.data, epoch)
  assert.equal(writes, 1)
  assert.equal(store.state.status, 'unlocked')
  assert.equal(store.state.session!.dirty, false)
  assert.deepEqual(store.state.session!.data, data)
})

test('a wrong recovery secret cannot alter an existing vault or its unsaved data', async () => {
  let writes = 0
  const store = new VaultStore(async () => 'token', async () => { writes++; return Response.json(record) })
  const edited = { ...data, currency: 'USD' }
  const session = { data: edited, key: created.key, envelope: created.envelope, dirty: true }
  store.state = { status: 'unlocked', record, session, busy: false, saving: false, saveError: false, credentialErrors: [], conflict: false, message: '' }
  const wrong = created.recoverySecret.replace(/[0-9a-f]/, value => value === 'a' ? 'b' : 'a')
  await assert.rejects(store.importBackup(exportBackup(created.envelope), wrong, store.generation, 'new recovery passphrase'))
  assert.equal(writes, 0)
  assert.equal(store.state.session, session)
  assert.equal(store.state.record, record)
  assert.equal(store.state.status, 'unlocked')
  assert.equal(store.state.session!.dirty, true)
  assert.equal(store.state.session!.data.currency, 'USD')
})

test('locking a recovery import prevents returning the recovered candidate', async () => {
  const store = new VaultStore(async () => 'token')
  const pending = store.importBackup(exportBackup(created.envelope), created.recoverySecret,
    store.generation, 'replacement import passphrase')
  store.lock()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(store.state.session, null)
  assert.equal(store.state.status, 'locked')
})

test('recovery import rejects an unsupported decrypted schema while retaining current edits', async () => {
  const unsupported = await createVault({ ...data, version: 999 }, passphrase)
  let writes = 0
  const store = new VaultStore(async () => 'token', async () => { writes++; return Response.json(record) })
  const session = { data, key: created.key, envelope: created.envelope, dirty: true }
  store.state = { status: 'unlocked', record, session, busy: false, saving: false, saveError: false, credentialErrors: [], conflict: false, message: '' }
  await assert.rejects(store.importBackup(exportBackup(unsupported.envelope), unsupported.recoverySecret,
    store.generation, 'valid replacement passphrase'), /unsupported schema version/)
  assert.equal(writes, 0)
  assert.equal(store.state.session, session)
  assert.equal(store.state.record, record)
  assert.equal(store.state.session!.dirty, true)
})


test('MVP edits preserve retired planning fields through real encrypted save and reload', async () => {
  const legacy = createDefaultFinanceData('2026-10-12');
  legacy.plan.setupCompleted = true;
  legacy.plan.allocations = [{ id: 'saved-rule', kind: 'invest', amount: 50000, targetId: null }];
  legacy.plan.policyNotes = 'Synthetic saved note';
  legacy.income.annualRealGrowthPercent = 2.5;
  legacy.fire.monthlyContribution = 50000;
  legacy.fire.costs = [{ id: 'old-cost', label: 'Synthetic cost', amount: 10000, startsOn: '2027-01-01', endsOn: null, frequency: 'once', earmarkId: null }];
  const old = await createVault(legacy, passphrase);
  let stored = { ...record, envelope: old.envelope };
  const store = new VaultStore(async () => 'token', async (_url, options) => {
    if (options?.method === 'PUT') {
      const body = JSON.parse(String(options.body));
      assert.equal(body.expectedRevision, stored.revision);
      stored = { ...stored, envelope: body.envelope, revision: stored.revision + 1 };
    }
    return Response.json(stored);
  });
  await store.load();
  await store.unlock(passphrase);
  const next = { ...store.state.session!.data, income: { ...store.state.session!.data.income, regularAmount: 250000 } };
  store.update(next);
  await store.save();
  assert.equal(store.state.session!.dirty, false);
  store.lock();
  await store.load();
  await store.unlock(passphrase);
  assert.deepEqual(store.state.session!.data, next);
  assert.deepEqual(store.state.session!.data.fire, legacy.fire);
  assert.deepEqual(store.state.session!.data.plan, legacy.plan);
});
