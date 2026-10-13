import { useLayoutEffect, useRef, useState } from 'react'
import { FinanceDateInput } from './FinanceControls'
import { formatMoney, formatDate, validateFinanceData, type FinanceData, type Portfolio } from './model'
import { Amount, Field, InvestmentFlowsEditor, today } from './PlanEditor'

export function CheckInDrawer({ data, onFinish, onClose, onManage, onDirty }: {
  data: FinanceData
  onFinish: (data: FinanceData) => void
  onClose: () => void
  onManage: () => void
  onDirty: (dirty: boolean) => void
}) {
  const [draft, setDraft] = useState<FinanceData>(() => ({ ...data, portfolios: data.portfolios.map(row => ({ ...row, totalWithdrawals: row.totalWithdrawals ?? 0, cashFlowsConfirmed: false })) }))
  const [changes, setChanges] = useState(() => Object.fromEntries(data.portfolios.map(row => [row.id, { added: 0, takenOut: 0 }])))
  const [date, setDate] = useState(today)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const dirty = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const accounts = [
    ...draft.cash.map(row => ({ kind: 'Cash' as const, row })),
    ...draft.portfolios.map(row => ({ kind: 'Investment' as const, row })),
    ...draft.debts.map(row => ({ kind: 'Loan' as const, row })),
  ]
  useLayoutEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    return () => { element.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  useLayoutEffect(() => { dialog.current?.querySelector<HTMLElement>(`[data-step="${step}"] h3`)?.focus() }, [step])
  const usesChanges = (row: Portfolio) => row.totalContributions !== null && date >= (row.observedOn ?? data.plan.asOf)
  const changed = () => { dirty.current = true; onDirty(true); setError('') }
  const leave = (next = onClose) => {
    if (!dirty.current || window.confirm('Discard this unfinished check-in?')) next()
  }
  const advance = () => {
    const invalid = dialog.current?.querySelector<HTMLInputElement>('input:invalid')
    if (invalid) {
      const panel = invalid.closest<HTMLElement>('[data-step]')
      if (panel) setStep(Number(panel.dataset.step))
      requestAnimationFrame(() => invalid.reportValidity())
      return
    }
    try {
      const observed = validateFinanceData({
        ...draft,
        plan: { ...draft.plan, asOf: today() },
        cash: draft.cash.map(row => ({ ...row, observedOn: row.balance === null ? null : date })),
        portfolios: draft.portfolios.map(row => {
          const original = data.portfolios.find(account => account.id === row.id)!
          // boffin: add changes to the saved baseline once, never to a draft already advanced through a step.
          return { ...row, observedOn: row.balance === null ? null : date, ...(usesChanges(original) ? {
            totalContributions: original.totalContributions! + changes[row.id].added,
            totalWithdrawals: (original.totalWithdrawals ?? 0) + changes[row.id].takenOut,
          } : {}) }
        }),
        debts: draft.debts.map(row => ({ ...row, observedOn: date })),
      })
      if (step < accounts.length - 1) { setStep(step + 1); setError(''); return }
      const next = validateFinanceData({ ...observed, snapshots: [...observed.snapshots, {
        id: crypto.randomUUID(), date, incomeAnnual: null,
        cash: observed.cash.map(({ id, balance, observedOn }) => ({ id, balance, observedOn })),
        portfolios: observed.portfolios.map(({ id, balance, observedOn, totalContributions, totalWithdrawals, cashFlowsConfirmed }) => ({ id, balance, observedOn, totalContributions, totalWithdrawals, cashFlowsConfirmed })),
        debts: observed.debts.map(({ id, balance, observedOn }) => ({ id, balance, observedOn })),
      }] })
      onFinish(next)
    } catch (cause) { setError((cause as Error).message) }
  }
  return <dialog ref={dialog} className="finance-drawer" aria-labelledby="checkin-title" onCancel={e => { e.preventDefault(); leave() }}>
    <div className="finance-drawer__heading"><h2 id="checkin-title">Check-in</h2><button type="button" aria-label="Close check-in" onClick={() => leave()}>×</button></div>
    <form noValidate onSubmit={e => { e.preventDefault(); advance() }} onChange={changed}>
      {accounts.length > 0 ? <>
        <div className="finance-checkin-meta">
          <Field label="Balance date"><FinanceDateInput required min="1900-01-01" max={today()} value={date} onChange={value => { setDate(value); changed() }} /></Field>
          <div className="finance-checkin-progress"><span>{step + 1} / {accounts.length}</span><progress aria-label="Check-in progress" value={step + 1} max={accounts.length} /></div>
        </div>
        {/* boffin: hidden steps stay mounted so going back cannot erase an invalid amount. */}
        {accounts.map(({ kind, row }, index) => {
          const previous = [...data.cash, ...data.portfolios, ...data.debts].find(r => r.id === row.id)!
          const incremental = kind === 'Investment' && usesChanges(data.portfolios.find(r => r.id === row.id)!)
          return <section key={row.id} data-step={index} hidden={step !== index} className="finance-checkin-step">
          <header className="finance-checkin-account"><h3 tabIndex={-1}>{row.label}</h3><small>{kind}</small></header>
          <div className="finance-checkin-row"><Amount currency={draft.currency} label={kind === 'Loan' ? 'Still owed' : 'Balance now'} inputLabel={row.label} optional={kind !== 'Loan'} value={row.balance} onChange={balance => {
            if (kind === 'Cash') setDraft({ ...draft, cash: draft.cash.map(r => r.id === row.id ? { ...r, balance } : r) })
            else if (kind === 'Investment') setDraft({ ...draft, portfolios: draft.portfolios.map(r => r.id === row.id ? { ...r, balance } : r) })
            else setDraft({ ...draft, debts: draft.debts.map(r => r.id === row.id ? { ...r, balance: balance! } : r) })
          }} /></div>
          <p className="finance-checkin-previous">{previous.balance === null ? 'No previous balance' : `Previously ${formatMoney(previous.balance, data.currency, 0)} · ${formatDate(previous.observedOn!)}`}</p>
          {kind === 'Investment' && <div className="finance-checkin-flows">
            <fieldset hidden={!incremental} disabled={!incremental}>
              <p className="finance-muted">Since {formatDate(previous.observedOn ?? data.plan.asOf)}</p>
              <div className="finance-fields">
                <Amount currency={draft.currency} label="Money added" inputLabel={`${row.label} added since last update`} value={changes[row.id].added} onChange={added => setChanges({ ...changes, [row.id]: { ...changes[row.id], added: added! } })} />
                <Amount currency={draft.currency} label="Money taken out" inputLabel={`${row.label} taken out since last update`} value={changes[row.id].takenOut} onChange={takenOut => setChanges({ ...changes, [row.id]: { ...changes[row.id], takenOut: takenOut! } })} />
              </div>
            </fieldset>
            <fieldset hidden={incremental} disabled={incremental}>
              <p className="finance-muted">{data.portfolios.find(r => r.id === row.id)!.totalContributions === null ? 'Starting totals have not been recorded yet.' : 'Earlier date: enter the totals as they were then.'}</p>
              <InvestmentFlowsEditor currency={draft.currency} portfolio={row} onChange={patch => setDraft({ ...draft, portfolios: draft.portfolios.map(r => r.id === row.id ? { ...r, ...patch } : r) })} />
            </fieldset>
          </div>}
        </section>})}

        {error && <p role="alert" className="finance-notice">{error}</p>}
        <div className="finance-drawer__actions">{step > 0 && <button type="button" onClick={() => { setStep(step - 1); setError('') }}>Back</button>}<button className="finance-primary">{step < accounts.length - 1 ? 'Next' : 'Finish check-in'}</button></div>
      </> : <><p>Add an account to start.</p><button type="button" onClick={() => leave(onManage)}>Add account</button></>}
    </form>
  </dialog>
}
