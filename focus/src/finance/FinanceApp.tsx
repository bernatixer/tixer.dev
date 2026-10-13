import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth, useSession, SignIn, UserButton } from '@clerk/clerk-react'
import { AppHeader } from '@/components/AppHeader'
import { Overview } from './Overview'
import { CheckInDrawer } from './CheckInDrawer'
import { FinanceSelect } from './FinanceControls'
import { startInactivityLock } from './lifecycle'
import { VaultStore } from './session'
import { createVault, rotateRecovery, encryptVault } from './crypto'
import { MAX_ENVELOPE_BYTES } from './envelope'
import { createDefaultFinanceData, validateFinanceData, type FinanceData } from './model'
import { Field, NumberField, BaselineEditor, BalanceEditor, revealInvalidField, today } from './PlanEditor'
import './finance.css'

function download(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = 'focus-encrypted-vault.json'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function Secret({ label, name = 'passphrase', confirm = false }: { label: string; name?: string; confirm?: boolean }) {
  return <Field label={label}><input name={name} type="password" autoComplete={confirm ? 'new-password' : 'current-password'} required minLength={confirm ? 12 : 1} maxLength={1024} spellCheck={false} /></Field>
}
function newPassword(form: HTMLFormElement) {
  const values = new FormData(form)
  const pass = String(values.get('passphrase') ?? '')
  if (pass !== values.get('confirm')) throw new Error('Passphrases do not match.')
  return pass
}
function ImportVault({ store }: { store: VaultStore }) {
  const [file, setFile] = useState<File | null>(null)
  const [useRecovery, setUseRecovery] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form)
    let password: string | undefined
    try { if (useRecovery) password = newPassword(form) } catch (err) { setError((err as Error).message); return }
    const secret = String(values.get(useRecovery ? 'recovery' : 'passphrase')); form.reset(); setError('')
    void store.run(async epoch => {
      try {
        if (!file || file.size > MAX_ENVELOPE_BYTES) throw new Error('Choose an encrypted backup smaller than 512 KiB.')
        const prepared = await store.importBackup(await file.text(), secret, epoch, password)
        if (!active.current) return
        if (!window.confirm('Replace your saved finances and any unsaved edits with this backup? Export your current data first if you need it.')) return
        await store.install(prepared.envelope, prepared.key, prepared.data, epoch)
      } catch { if (active.current) setError('Could not restore this backup. Check the file and its password or recovery key. Your current finances are unchanged.') }
    })
  }
  return <details className="finance-details"><summary>Restore a backup</summary><form onSubmit={submit}>
    <p>Choose a file you exported from Finance. You’ll need its password or recovery key. Restoring replaces the finances saved to this account.</p>
    <Field label="Backup file"><input type="file" accept=".json,application/json" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></Field>
    <label className="finance-check"><input type="checkbox" checked={useRecovery} onChange={e => setUseRecovery(e.target.checked)} />Restore using a recovery key</label>
    {useRecovery ? <><Secret label="Backup recovery key" name="recovery" /><Secret label="New backup passphrase" confirm /><Secret label="Confirm backup passphrase" name="confirm" confirm /></> : <Secret label="Backup passphrase" />}<button disabled={store.state.busy}>Restore backup</button>{error && <p role="alert">{error}</p>}
  </form></details>
}
function LockedVault({ store }: { store: VaultStore }) {
  const [pending, setPending] = useState<(Awaited<ReturnType<typeof createVault>> & { data: FinanceData; generation: number }) | null>(null)
  const [ack, setAck] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false; setPending(null) } }, [])
  const absent = store.state.status === 'absent'
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; setError('')
    if (absent) {
      let pass: string
      try { pass = newPassword(form) } catch (e) { setError((e as Error).message); return }
      form.reset()
      void store.run(async generation => { const data = createDefaultFinanceData(today()); const created = await createVault(data, pass, store.signal); if (active.current && generation === store.generation) setPending({ ...created, data, generation }) })
    } else {
      const pass = String(new FormData(form).get('passphrase')); form.reset(); void store.unlock(pass)
    }
  }
  return <div className="finance-gate">
    <span className="finance-eyebrow">FINANCE</span>
    <h1>{pending ? 'Save recovery key' : absent ? 'Create vault' : 'Unlock your finances'}</h1>
    {!pending && !absent && <p className="finance-gate__intro">Enter the password you chose when setting up Finance.</p>}
    {pending ? <>
      <p>This is the only time this key is shown. Save it outside this browser. Anyone with it and your encrypted vault can decrypt your data.</p>
      <output className="finance-recovery">{pending.recoverySecret}</output>
      <label className="finance-check"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />I saved my recovery key in a safe place.</label>
      <button className="finance-primary" disabled={!ack || store.state.busy} onClick={() => void store.run(async () => { await store.install(pending.envelope, pending.key, pending.data, pending.generation) })}>Create encrypted vault</button>
      <button onClick={() => { setPending(null); setAck(false) }}>Cancel</button>
    </> : <form onSubmit={submit} className="finance-unlock-form">
      <Secret label={absent ? 'New vault passphrase (12+ characters)' : 'Finance password'} confirm={absent} />
      {!absent && <p className="finance-gate__hint">Different from your sign-in password.</p>}
      {absent && <Secret label="Confirm passphrase" name="confirm" confirm />}
      <button className="finance-primary" disabled={store.state.busy}>{store.state.busy ? 'Working securely…' : absent ? 'Generate recovery key' : 'Unlock finances'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {absent && !pending && <p className="finance-muted">Choose a separate password for Finance. Resetting your sign-in password won’t reset this one.</p>}
    {!absent && !pending && <details className="finance-details finance-gate__help"><summary>Can’t unlock?</summary>
      <p>Resetting your sign-in password won’t unlock your finances. Use your recovery key or an exported backup.</p>
      <details className="finance-details"><summary>Use a recovery key</summary><p>Use the key you saved when setting up Finance to choose a new password.</p><form onSubmit={e => {
      e.preventDefault(); const form = e.currentTarget
      try { const pass = newPassword(form); const secret = String(new FormData(form).get('recovery')); form.reset(); void store.recover(secret, pass) } catch (err) { setError((err as Error).message) }
    }}><Secret label="Recovery key" name="recovery" /><Secret label="New finance password (12+ characters)" confirm /><Secret label="Confirm new finance password" name="confirm" confirm /><button disabled={store.state.busy}>Set new password</button></form></details>
      <ImportVault store={store} />
    </details>}
    {absent && !pending && <ImportVault store={store} />}
    <a className="finance-back" href="/">← Back to Focus</a>
  </div>
}

function DeleteVault({ store }: { store: VaultStore }) {
  const [confirmation, setConfirmation] = useState('')
  return <><p>This permanently deletes your saved finances. Exported backups are kept. Type DELETE to continue.</p><Field label="Deletion confirmation"><input autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></Field><button className="finance-danger" disabled={confirmation !== 'DELETE' || store.state.busy} onClick={() => { if (window.confirm('Permanently delete your saved finances and discard unsaved edits? You can only restore them with a usable backup.')) void store.remove() }}>Delete finance data</button></>
}

function VaultSettings({ store, data }: { store: VaultStore; data: FinanceData }) {
  const [recovery, setRecovery] = useState<Awaited<ReturnType<typeof rotateRecovery>> | null>(null)
  const [ack, setAck] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false; setRecovery(null) } }, [])
  useEffect(() => { setRecovery(null); setAck(false) }, [store.state.session?.key])
  return <>
    <h2>Vault settings</h2>
    <fieldset className="finance-preferences finance-fields" data-autosave disabled={store.state.busy && !store.state.saving}><Field label="Vault currency" hint="Relabels existing amounts; does not convert them."><FinanceSelect value={data.currency} onChange={currency => store.update({ ...data, currency })} options={['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN'].map(id => ({ id, label: id }))} /></Field><NumberField label="Inactivity lock (minutes)" value={data.plan.lockAfterMinutes} min={1} max={60} step="1" onChange={n => store.update({ ...data, plan: { ...data.plan, lockAfterMinutes: n } })} /></fieldset>
    <p className="finance-muted">Switching browser tabs keeps it unlocked until the inactivity timeout. Leaving Finance or reloading locks it. Automatic locking discards unsaved edits; nothing is written as plaintext. JavaScript cannot guarantee memory erasure.</p>
    <p className="finance-notice">Changing your password or recovery key keeps the same data encryption key. Someone with an old backup and its password or recovery key can still decrypt future vault data if they obtain a later encrypted copy. These changes do not secure a compromised vault.</p>
    <article className="finance-card"><h3>Change passphrase</h3><form onSubmit={e => { e.preventDefault(); try { const pass = newPassword(e.currentTarget); e.currentTarget.reset(); void store.changePassword(pass) } catch (err) { setError((err as Error).message) } }}><Secret label="New passphrase" confirm /><Secret label="Confirm new passphrase" confirm name="confirm" /><button disabled={store.state.busy}>Change & save</button></form></article>
    <article className="finance-card"><h3>Recovery key</h3><p>The saved key cannot be displayed again. Generate a replacement while unlocked, then acknowledge saving it.</p>
      {recovery ? <><output className="finance-recovery">{recovery.recoverySecret}</output><label className="finance-check"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />I saved this replacement recovery key.</label><button disabled={!ack || store.state.busy} onClick={() => void store.run(async epoch => {
        const session = store.state.session; if (!session) return
        const envelope = await encryptVault(session.data, session.key, { ...session.envelope, recoveryWrap: recovery.envelope.recoveryWrap })
        if (active.current) { await store.install(envelope, session.key, session.data, epoch); if (store.state.message === 'Encrypted vault saved.') { setRecovery(null); setAck(false) } }
      }, 'recovery')}>Save replacement key</button><button onClick={() => { setRecovery(null); setAck(false) }}>Cancel</button></> : <button disabled={store.state.busy} onClick={() => void store.run(async () => { const s = store.state.session; if (s) { const next = await rotateRecovery(s.envelope, s.key); if (active.current) setRecovery(next) } })}>Generate replacement recovery key</button>}
    </article>
    <article className="finance-card"><h3>Encrypted backup</h3><p>Export includes unsaved edits while unlocked. Keep the file and passphrase or recovery key separately. Exports include ciphertext and cryptographic parameters only.</p><button disabled={store.state.busy} onClick={() => void store.run(async () => download(await store.backup()))}>Export encrypted vault</button><ImportVault store={store} /></article>
    <article className="finance-card"><h3>Delete vault</h3><DeleteVault store={store} /></article>
    {error && <p role="alert">{error}</p>}
    <p className="finance-muted">Encryption cannot protect a compromised device, browser, same-origin script or deployment. The service knows the owner, opaque vault ID, ciphertext length, revision and update time. Weak passphrases can be guessed offline. A valid older encrypted copy can be replayed by a compromised server; revisions prevent accidental stale writes, not malicious rollback. <a href="https://bogleheads.es/guia" target="_blank" rel="noreferrer">Educational guide ↗</a></p>
  </>
}

export function FinanceExperience({ getToken, account }: { getToken: () => Promise<string | null>; account?: ReactNode }) {
  const token = useRef(getToken); token.current = getToken
  const [store] = useState(() => new VaultStore(() => token.current()))
  const [, render] = useState(0)
  const [tab, setTab] = useState('Overview')
  const [portfolioToEdit, setPortfolioToEdit] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [validation, setValidation] = useState('')
  const [checkIn, setCheckIn] = useState(false)
  const [inputVersion, setInputVersion] = useState(0)
  const [inputsInvalid, setInputsInvalid] = useState(false)
  const checkInDirty = useRef(false)
  const rawDirty = useRef(false)
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    if (tab === 'Accounts' && portfolioToEdit) {
      const row = root.current?.querySelector(`#finance-portfolio-${portfolioToEdit}`)
      const amounts = Array.from(row?.querySelectorAll<HTMLInputElement>('.finance-amount-input') ?? [])
      const target = amounts.find(input => input.value === '') ?? amounts[0]
      target?.focus()
    } else root.current?.querySelector<HTMLButtonElement>('.finance-tabs [aria-current]')?.focus({ preventScroll: true })
  }, [tab, portfolioToEdit])
  useEffect(() => {
    store.onChange = () => render(n => n + 1); void store.load()
    const leave = () => store.lock()
    const before = (e: BeforeUnloadEvent) => { if (store.state.session?.dirty || rawDirty.current || checkInDirty.current) { e.preventDefault(); e.returnValue = '' } }
    const restore = (e: PageTransitionEvent) => { if (e.persisted) { store.lock(); location.reload() } }
    window.addEventListener('pagehide', leave); window.addEventListener('pageshow', restore); window.addEventListener('beforeunload', before)
    return () => { store.destroy(); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', restore); window.removeEventListener('beforeunload', before) }
  }, [store])
  const state = store.state
  const session = state.session
  const calculationData = session ? { ...session.data, plan: { ...session.data.plan, asOf: session.data.plan.asOf > today() ? session.data.plan.asOf : today() } } : null
  const setup = session && !session.data.plan.setupCompleted
  let valid = false
  if (session) { try { validateFinanceData(session.data); valid = true } catch { /* Drafts may be incomplete while editing. */ } }
  useEffect(() => {
    if (!session) { setPortfolioToEdit(null); setCheckIn(false); setValidation(''); setStep(1); checkInDirty.current = false; rawDirty.current = false; return }
    return startInactivityLock(() => store.lock(), session.data.plan.lockAfterMinutes * 60_000)
  }, [store, Boolean(session), session?.data.plan.lockAfterMinutes])
  useEffect(() => {
    const invalid = Boolean(root.current?.querySelector('[data-autosave] input:invalid, [data-autosave] select:invalid, [data-autosave] textarea:invalid'))
    setInputsInvalid(invalid); rawDirty.current = invalid
    if (!session || setup || !session.dirty || state.busy || state.conflict || state.saveError || invalid) return
    // boffin: raw invalid fields block autosave even when the model still holds their preceding value.
    const timer = setTimeout(() => {
      if (root.current?.querySelector('[data-autosave] input:invalid, [data-autosave] select:invalid, [data-autosave] textarea:invalid')) return
      try { validateFinanceData(session.data) }
      catch (error) { setValidation((error as Error).message); return }
      void store.save()
    }, 800)
    return () => clearTimeout(timer)
  }, [store, session?.data, session?.dirty, setup, state.busy, state.conflict, state.saveError, inputVersion, tab])
  const onChange = (data: FinanceData) => { setValidation(''); store.update({ ...data, plan: { ...data.plan, asOf: today() } }) }
  const validate = () => {
    const invalid = root.current?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLFormElement>('[data-autosave] input:invalid, [data-autosave] select:invalid, [data-autosave] textarea:invalid')
    if (invalid) { invalid.reportValidity(); return false }
    try { validateFinanceData(store.state.session?.data); setValidation(''); return true }
    catch (e) { setValidation((e as Error).message); return false }
  }
  const save = async () => { if (validate()) await store.save() }
  const lock = () => { if (!(session?.dirty || rawDirty.current || checkInDirty.current) || window.confirm('Lock now and discard unsaved edits?')) store.lock() }
  const navigate = (name: string, portfolioId: string | null = null) => { if ((state.busy && !state.saving) || !validate()) return; setTab(name); setPortfolioToEdit(portfolioId); setValidation('') }
  const editSection = (portfolioId?: string) => navigate('Accounts', portfolioId ?? null)
  const startCheckIn = () => { if ((!state.busy || state.saving) && validate()) setCheckIn(true) }
  const closeCheckIn = () => { setCheckIn(false); checkInDirty.current = false }
  const saveStatus = state.conflict ? 'Save conflict' : state.saveError ? 'Not saved' : !valid || inputsInvalid || state.credentialErrors.length > 0 ? 'Needs attention' : state.saving ? 'Saving…' : state.busy ? 'Working…' : session?.dirty ? 'Unsaved changes' : 'Saved'
  return <main ref={root} className="finance-app" onChange={e => { if ((e.target as HTMLElement).closest('[data-autosave]')) { rawDirty.current = true; setInputVersion(n => n + 1) } }}>
    <AppHeader mode="finance">{session && <>
      <span role="status" aria-live="polite" className="finance-save-status">{saveStatus}</span>
      <button type="button" className="header-btn header-icon" aria-label="Vault settings" title="Vault settings" aria-pressed={tab === 'Vault'} onClick={() => navigate(tab === 'Vault' ? 'Overview' : 'Vault')}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m10 2-.6 2.4-2 .8-2.1-1.3-2.8 4.8 2.1 1.5-.1 2.1L2.5 14l2.8 4.8 2.3-.7 1.8 1.1L10 22h5l.6-2.8 1.8-1.1 2.3.7 2.8-4.8-2-1.7-.1-2.1 2.1-1.5-2.8-4.8-2.1 1.3-2-.8L15 2Zm2.5 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" /></svg></button>
      <button type="button" className="header-btn header-icon" aria-label="Lock vault" title="Lock vault" onClick={lock}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 10V7a6 6 0 0 1 12 0v3h2v12H4V10Zm3 0h6V7a3 3 0 0 0-6 0Zm2 4v4h2v-4Z" /></svg></button>
    </>}{account}</AppHeader>
    {!session && <div role="status" aria-live="polite" className={`finance-status ${state.message ? '' : 'finance-status--empty'}`}>{state.busy ? 'Working securely…' : state.message}</div>}
    {state.status === 'loading' ? <p className="finance-loading">Loading encrypted vault…</p> : state.status === 'error' ? <div className="finance-gate"><h1>Vault unavailable</h1><p>Could not reach your vault. Your stored data has not changed.</p><button onClick={() => void store.load()}>Retry</button></div> : !session ? <LockedVault key={state.status} store={store} /> : <>
      {setup ? <><div className="finance-steps" aria-label="Setup progress">{['Vault', 'Income & spending', 'Accounts'].map((name, i) => <span key={name} aria-current={step === i ? 'step' : undefined} className={i <= step ? 'is-active' : ''}>{i < step ? '✓' : i + 1} {name}</span>)}</div><h2>{['', 'Income & spending', 'Accounts & balances'][step]}</h2></> : <div className="finance-viewbar"><nav className="finance-tabs" aria-label="Finance sections">{['Overview', 'Accounts', 'Plan'].map(name => <button key={name} aria-current={tab === name ? 'page' : undefined} onClick={() => navigate(name)}>{name}</button>)}</nav><button className="finance-primary" onClick={startCheckIn}>Check-in</button></div>}
      {state.credentialErrors.length > 0 && <div role="alert" className="finance-notice">
        {state.credentialErrors.map(credential => <p key={credential}>{credential === 'password' ? 'Password' : 'Recovery-key'} change was not confirmed. Retry it in Vault settings. Saving your plan will not apply it.{' '}<button disabled={state.busy} onClick={() => store.dismissCredentialError(credential)}>Dismiss {credential === 'password' ? 'password' : 'recovery-key'} warning</button></p>)}
        {tab !== 'Vault' && <button disabled={state.busy} onClick={() => navigate('Vault')}>Review credential changes</button>}
      </div>}
      {(state.saveError || state.conflict) && <div role="alert" className="finance-notice"><p>{state.message || 'Changes could not be saved. Your edits remain in this unlocked page.'}</p><div className="finance-recovery-actions">
        {!state.conflict && <button disabled={state.busy} onClick={() => void save()}>Retry save</button>}
        <button disabled={state.busy} onClick={() => void store.run(async () => download(await store.backup()))}>Export unsaved copy</button>
        {state.conflict && <button disabled={state.busy} onClick={() => { if (window.confirm('Discard local edits and lock while loading the latest server copy?')) void store.load() }}>Load server copy</button>}
      </div></div>}
      {!state.saveError && !state.conflict && state.message && state.message !== 'Encrypted vault saved.' && !state.message.startsWith('Vault upgraded') && <p role="alert" className="finance-notice">{state.message}</p>}
      {setup || tab === 'Plan' || tab === 'Accounts' ? <form data-autosave className="finance-editor" onInvalidCapture={revealInvalidField} onSubmit={e => e.preventDefault()}>
        <fieldset disabled={state.busy && !state.saving}>
          {!setup && tab === 'Plan' && <BaselineEditor data={session.data} onChange={onChange} />}
          {!setup && tab === 'Accounts' && <BalanceEditor portfolioToEdit={portfolioToEdit} data={session.data} onChange={onChange} />}
          {setup && step === 1 && <BaselineEditor data={session.data} onChange={onChange} />}
          {setup && step === 2 && <BalanceEditor data={session.data} onChange={onChange} />}
          {validation && <p role="alert" className="finance-notice">{validation}</p>}
          {setup && <div className="finance-actions">
            {step > 1 && <button type="button" onClick={() => { if (validate()) setStep(n => n - 1) }}>Back</button>}
            <button type="button" className="finance-primary" onClick={() => { if (!validate()) return; if (step < 2) { void store.save(); setStep(n => n + 1) } else { store.update({ ...session.data, plan: { ...session.data.plan, setupCompleted: true } }); void store.save() } }}>{step < 2 ? 'Save & continue' : 'Finish setup'}</button>
          </div>}
        </fieldset>
      </form> : tab === 'Overview' ? valid ? <Overview data={calculationData!} onEditAccounts={editSection} /> : <p className="finance-notice">Open Plan to correct incomplete fields before calculating.</p> : <VaultSettings store={store} data={session.data} />}
      {checkIn && <CheckInDrawer data={session.data} onDirty={dirty => { checkInDirty.current = dirty }} onClose={closeCheckIn} onManage={() => { closeCheckIn(); editSection() }} onFinish={data => { onChange(data); closeCheckIn() }} />}
    </>}
  </main>
}

export function FinanceApp() {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth()
  const { session } = useSession()
  if (!isLoaded) return <p className="finance-loading">Loading sign-in…</p>
  if (!isSignedIn || !userId || !session) return <main className="finance-app"><div className="finance-gate"><span className="finance-eyebrow">FOCUS / FINANCE</span><h1>Sign in to Finance</h1><p>Your login controls access to ciphertext. Your separate vault passphrase unlocks its contents.</p><SignIn forceRedirectUrl="/finance.html" signUpForceRedirectUrl="/finance.html" /><a href="/">← Back to Focus</a></div></main>
  return <FinanceExperience key={`${userId}:${sessionId}`} getToken={() => session.getToken()} account={<UserButton appearance={{ elements: { avatarBox: 'user-avatar' } }} />} />
}
