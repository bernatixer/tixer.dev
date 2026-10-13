import { cloneElement, useEffect, useId, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import { parseMoney, formatMoney, type FinanceData, type CashAccount, type Portfolio, type Debt } from './model'
import { FinanceDateInput, FinanceSelect } from './FinanceControls'
import './plan-editor.css'

type EditorProps = { data: FinanceData; onChange: (data: FinanceData) => void }
const id = () => crypto.randomUUID()
export const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function revealInvalidField(event: FormEvent<HTMLElement>) {
  let parent = (event.target as HTMLElement).parentElement
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true
    parent = parent.parentElement
  }
}

export function Field({ label, children, hint, suffix }: { label: string; children: ReactElement<{ id?: string; 'aria-describedby'?: string }>; hint?: string; suffix?: string }) {
  const id = useId()
  const input = cloneElement(children, { id, 'aria-describedby': [hint && `${id}-hint`, suffix && `${id}-suffix`].filter(Boolean).join(' ') || undefined })
  return <div className="finance-field"><label htmlFor={id}>{label}</label>{suffix ? <span className="finance-input-affix">{input}<span id={`${id}-suffix`}>{suffix}</span></span> : input}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>
}
export function Amount({ label, inputLabel, value, currency, onChange, optional = false }: { currency: string; label: string; inputLabel?: string; value: number | null; onChange: (n: number | null) => void; optional?: boolean }) {
  const [raw, setRaw] = useState(value === null ? '' : String(value / 100).replace('.', ','))
  const lastValue = useRef(value)
  useEffect(() => {
    if (lastValue.current !== value) { lastValue.current = value; setRaw(value === null ? '' : String(value / 100).replace('.', ',')) }
  }, [value])
  const symbol = new Intl.NumberFormat('de-DE', { style: 'currency', currency }).formatToParts(0).find(part => part.type === 'currency')!.value
  return <Field label={label} suffix={symbol}><input className="finance-amount-input" aria-label={inputLabel} inputMode="decimal" value={raw} required={!optional} onChange={event => {
    const input = event.currentTarget; setRaw(input.value)
    try { const next = input.value === '' && optional ? null : parseMoney(input.value); lastValue.current = next; onChange(next); input.setCustomValidity('') }
    catch { input.setCustomValidity('Enter a nonnegative amount with at most two decimals. Use comma or dot; no grouping separators.') }
  }} /></Field>
}
export function NumberField({ label, inputLabel, value, onChange, min = 0, max = 100, step = 'any' }: { label: string; inputLabel?: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: string }) {
  const [raw, setRaw] = useState(String(value))
  const lastValue = useRef(value)
  useEffect(() => {
    if (lastValue.current !== value) { lastValue.current = value; setRaw(String(value)) }
  }, [value])
  return <Field label={label}><input className="finance-number-input" aria-label={inputLabel} type="number" required min={min} max={max} step={step} value={raw} onChange={event => {
    setRaw(event.currentTarget.value)
    if (event.currentTarget.value !== '' && event.currentTarget.validity.valid) { const next = Number(event.currentTarget.value); lastValue.current = next; onChange(next) }
  }} /></Field>
}
function Remove({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" className="finance-remove" aria-label={`Remove ${label}`} onClick={onClick}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1 12H7L6 9Zm3 2v7h2v-7H9Zm4 0v7h2v-7h-2Z" /></svg>
  </button>
}

export function InvestmentFlowsEditor({ portfolio, currency, onChange }: { currency: string; portfolio: Portfolio; onChange: (patch: Partial<Portfolio>) => void }) {
  return <>
    <div className="finance-fields">
      <Amount currency={currency} optional label="Money added" inputLabel={`${portfolio.label} money added`} value={portfolio.totalContributions} onChange={totalContributions => onChange({ totalContributions, cashFlowsConfirmed: false })} />
      <Amount currency={currency} label="Money taken out" inputLabel={`${portfolio.label} money taken out`} value={portfolio.totalWithdrawals ?? 0} onChange={totalWithdrawals => onChange({ totalWithdrawals, cashFlowsConfirmed: false })} />
    </div>
    <p className="finance-muted">Totals since you started, including cash payouts.</p>
  </>
}

function EditableRow({ id, label, value, note, initiallyOpen = false, className = '', children }: { id?: string; label: string; value: ReactNode; note?: string; initiallyOpen?: boolean; className?: string; children: ReactNode }) {
  const open = useRef(initiallyOpen)
  return <details id={id} className={`finance-entry ${className}`} open={open.current}>
    <summary><span className="finance-entry__label">{label || 'Unnamed entry'}{note && <small>{note}</small>}</span><strong>{value}</strong><span className="finance-entry__edit">Edit</span></summary>
    <div className="finance-entry__fields">{children}</div>
  </details>
}

function PlanSection({ title, description, group, addLabel, onAdd, children, open = false }: {
  title: string; description: string; group: string; addLabel: string; onAdd: () => void; children: ReactNode; open?: boolean
}) {
  const section = useRef<HTMLDetailsElement>(null)
  return <div className="finance-baseline__panel">
    <details ref={section} className="finance-baseline__section" name={group} open={open}>
      <summary><span>{title}</span><small>{description}</small></summary>
      <div className="finance-baseline__content">{children}</div>
    </details>
    <button type="button" className="finance-section-add" aria-label={addLabel} title={addLabel.slice(2)} onClick={() => {
      section.current!.open = true
      const nested = section.current!.querySelector<HTMLDetailsElement>('.finance-details')
      if (nested) nested.open = true
      onAdd()
    }}>+</button>
  </div>
}

export function BaselineEditor({ data, onChange }: EditorProps) {
  const sections = useId()
  const income = (patch: Partial<FinanceData['income']>) => onChange({ ...data, income: { ...data.income, ...patch } })
  return <div className="finance-baseline">
    {/* boffin: keep closed sections mounted so unfinished amounts retain their validation errors. */}
    <PlanSection title="Income" description={`${formatMoney(data.income.regularAmount, data.currency, 0)} / payment · after tax`} group={sections} open addLabel="+ Extra payment" onAdd={() => income({ extraPayments: [...data.income.extraPayments, { id: id(), label: 'Extra payment', amount: 0 }] })}>
        <div className="finance-fields">
          <Amount currency={data.currency} label="Salary per payment (after tax)" value={data.income.regularAmount} onChange={n => income({ regularAmount: n! })} />
          <NumberField label="Regular payments per year" value={data.income.paymentsPerYear} onChange={n => income({ paymentsPerYear: n })} min={1} max={366} step="1" />
        </div>
        <details className="finance-details"><summary>Extra salary payments ({data.income.extraPayments.length})</summary><p className="finance-muted">Bonuses or unequal payments not included above.</p>
          {data.income.extraPayments.map(row => <EditableRow key={row.id} label={row.label} value={formatMoney(row.amount, data.currency, 0)} note="per year" initiallyOpen={row.amount === 0}>
            <div className="finance-row">
              <Field label="Payment label"><input required maxLength={120} value={row.label} onChange={e => income({ extraPayments: data.income.extraPayments.map(r => r.id === row.id ? { ...r, label: e.target.value } : r) })} /></Field>
              <Amount currency={data.currency} label="Extra income per year (after tax)" value={row.amount} onChange={n => income({ extraPayments: data.income.extraPayments.map(r => r.id === row.id ? { ...r, amount: n! } : r) })} />
              <Remove label={row.label} onClick={() => income({ extraPayments: data.income.extraPayments.filter(r => r.id !== row.id) })} />
            </div>
          </EditableRow>)}
        </details>
    </PlanSection>
    <PlanSection title="Spending" description={`Regular bills & everyday costs · ${data.expenses.length} ${data.expenses.length === 1 ? 'entry' : 'entries'}`} group={sections} addLabel="+ Recurring expense" onAdd={() => onChange({ ...data, expenses: [...data.expenses, { id: id(), label: 'Recurring expense', amount: 0, frequency: 'monthly', category: 'essential' }] })}>
        {data.expenses.map(row => {
          const edit = (patch: Partial<typeof row>) => onChange({ ...data, expenses: data.expenses.map(r => r.id === row.id ? { ...r, ...patch } : r) })
          return <EditableRow key={row.id} label={row.label} value={formatMoney(row.amount, data.currency, 0)} note={`${row.frequency === 'monthly' ? 'Monthly' : 'Annual'} · ${row.category === 'essential' ? 'Essential' : 'Optional spending'}`} initiallyOpen={row.amount === 0}>
            <div className="finance-row">
              <Field label="Expense label"><input required maxLength={120} value={row.label} onChange={e => edit({ label: e.target.value })} /></Field>
              <Amount currency={data.currency} label="Amount" value={row.amount} onChange={n => edit({ amount: n! })} />
              <Field label="Frequency"><FinanceSelect value={row.frequency} onChange={value => edit({ frequency: value as typeof row.frequency })} options={[{ id: 'monthly', label: 'Monthly' }, { id: 'annual', label: 'Annual' }]} /></Field>
              <Field label="Category"><FinanceSelect value={row.category} onChange={value => edit({ category: value as typeof row.category })} options={[{ id: 'essential', label: 'Essential' }, { id: 'discretionary', label: 'Optional spending' }]} /></Field>
              <Remove label={row.label} onClick={() => onChange({ ...data, expenses: data.expenses.filter(r => r.id !== row.id) })} />
            </div>
          </EditableRow>
        })}
    </PlanSection>
    <PlanSection title="Other costs" description="Repairs, holidays… · yearly amounts ÷ 12" group={sections} addLabel="+ Yearly cost" onAdd={() => onChange({ ...data, irregularExpenses: [...data.irregularExpenses, { id: id(), label: 'Yearly cost', annualAmount: 0, essential: false }] })}>
        {data.irregularExpenses.map(row => {
          const edit = (patch: Partial<typeof row>) => onChange({ ...data, irregularExpenses: data.irregularExpenses.map(r => r.id === row.id ? { ...r, ...patch } : r) })
          return <EditableRow key={row.id} label={row.label} value={formatMoney(row.annualAmount, data.currency, 0)} note={`Per year · ${row.essential ? 'Essential' : 'Optional spending'}`} initiallyOpen={row.annualAmount === 0}>
            <div className="finance-row">
              <Field label="Cost name"><input required value={row.label} maxLength={120} onChange={e => edit({ label: e.target.value })} /></Field>
              <Amount currency={data.currency} label="Yearly amount" value={row.annualAmount} onChange={n => edit({ annualAmount: n! })} />
              <Remove label={row.label} onClick={() => onChange({ ...data, irregularExpenses: data.irregularExpenses.filter(r => r.id !== row.id) })} />
            </div>
            <label className="finance-check"><input type="checkbox" checked={row.essential} onChange={e => edit({ essential: e.target.checked })} />Essential cost</label>
          </EditableRow>
        })}
    </PlanSection>

  </div>
}

export function BalanceEditor({ data, onChange, portfolioToEdit }: EditorProps & { portfolioToEdit?: string | null }) {
  const cashEdit = (row: CashAccount, patch: Partial<CashAccount>) => onChange({ ...data, cash: data.cash.map(r => r.id === row.id ? { ...r, ...patch } : r) })
  const portfolioEdit = (row: Portfolio, patch: Partial<Portfolio>) => onChange({ ...data, portfolios: data.portfolios.map(r => r.id === row.id ? { ...r, ...patch, ...('balance' in patch || 'observedOn' in patch ? { cashFlowsConfirmed: false } : {}) } : r) })
  const debtEdit = (row: Debt, patch: Partial<Debt>) => onChange({ ...data, debts: data.debts.map(r => r.id === row.id ? { ...r, ...patch } : r) })
  const observation = (value: number | null) => value === null ? null : today()
  const balance = (value: number | null) => value === null ? 'Unknown balance' : formatMoney(value, data.currency, 0)
  return <div className="finance-accounts">
    <section className="finance-account-group" aria-labelledby="finance-cash-title">
    <header><h3 id="finance-cash-title">Cash accounts</h3>
    <button type="button" className="finance-account-add" aria-label="+ Cash account" title="Add cash account" onClick={() => onChange({ ...data, cash: [...data.cash, { id: id(), label: 'Cash account', balance: null, observedOn: null, earmarks: [] }] })}>+</button><small>Current & savings accounts</small>
    </header>
    {data.cash.map(row => <EditableRow key={row.id} className="finance-account" label={row.label} value={balance(row.balance)} initiallyOpen={row.balance === null}>
      <div className="finance-row"><Field label="Cash label"><input required value={row.label} maxLength={120} onChange={e => cashEdit(row, { label: e.target.value })} /></Field>
        <Amount currency={data.currency} label="Cash balance (blank = unknown)" optional value={row.balance} onChange={n => cashEdit(row, { balance: n, observedOn: observation(n) })} />
        <Field label="Cash balance date"><FinanceDateInput required={row.balance !== null} max={today()} value={row.observedOn ?? ''} onChange={value => cashEdit(row, { observedOn: value || null })} /></Field>
        <Remove label={row.label} onClick={() => { const marks = new Set(row.earmarks.map(m => m.id)); onChange({ ...data, cash: data.cash.filter(r => r.id !== row.id), fire: { ...data.fire, costs: data.fire.costs.map(c => marks.has(c.earmarkId ?? '') ? { ...c, earmarkId: null } : c) } }) }} />
      </div>
      <div className="finance-savings"><details className="finance-details"><summary>Money set aside · {formatMoney(row.earmarks.reduce((sum, mark) => sum + mark.amount, 0), data.currency, 0)}</summary><p className="finance-muted">Money in this account reserved for emergencies or a planned cost. Already included in its balance.</p>
        {row.earmarks.map(mark => <EditableRow key={mark.id} label={mark.label} value={formatMoney(mark.amount, data.currency, 0)} note={mark.purpose === 'emergency' ? 'Emergency savings' : 'Other goal'} initiallyOpen={mark.amount === 0}>
          <div className="finance-row">
            <Field label="Saving for"><input required maxLength={120} value={mark.label} onChange={e => cashEdit(row, { earmarks: row.earmarks.map(m => m.id === mark.id ? { ...m, label: e.target.value } : m) })} /></Field>
            <Amount currency={data.currency} label="Amount set aside" value={mark.amount} onChange={n => cashEdit(row, { earmarks: row.earmarks.map(m => m.id === mark.id ? { ...m, amount: n! } : m) })} />
            <Field label="Savings type"><FinanceSelect value={mark.purpose === 'emergency' ? 'emergency' : 'other'} onChange={value => {
              const cash = data.cash.map(a => a.id === row.id ? { ...a, earmarks: a.earmarks.map(m => m.id === mark.id ? { ...m, purpose: value as 'emergency' | 'other', plannedCostId: null } : m) } : a)
              onChange({ ...data, cash, fire: { ...data.fire, costs: data.fire.costs.map(c => c.earmarkId === mark.id ? { ...c, earmarkId: null } : c) } })
            }} options={[{ id: 'emergency', label: 'Emergency savings' }, { id: 'other', label: 'Other goal' }]} /></Field>
            <Remove label={mark.label} onClick={() => onChange({ ...data, cash: data.cash.map(a => a.id === row.id ? { ...a, earmarks: a.earmarks.filter(m => m.id !== mark.id) } : a), fire: { ...data.fire, costs: data.fire.costs.map(c => c.earmarkId === mark.id ? { ...c, earmarkId: null } : c) } })} />
          </div>
        </EditableRow>)}
      </details><button type="button" className="finance-account-add" aria-label="+ Money set aside" title="Add savings goal" onClick={event => {
        (event.currentTarget.previousElementSibling as HTMLDetailsElement).open = true
        cashEdit(row, { earmarks: [...row.earmarks, { id: id(), label: 'Savings goal', amount: 0, purpose: 'other', plannedCostId: null }] })
      }}>+</button></div>
    </EditableRow>)}

    </section>
    <section className="finance-account-group" aria-labelledby="finance-funds-title">
    <header><h3 id="finance-funds-title">Investments</h3>
    <button type="button" className="finance-account-add" aria-label="+ Portfolio" title="Add portfolio" onClick={() => onChange({ ...data, portfolios: [...data.portfolios, { id: id(), label: 'Portfolio', balance: null, observedOn: null, equityPercent: null, bondPercent: null, totalContributions: null, totalWithdrawals: 0, cashFlowsConfirmed: false }] })}>+</button><small>Funds, shares & managed portfolios</small>
    </header>
    {data.portfolios.map(row => <EditableRow key={row.id} id={`finance-portfolio-${row.id}`} className="finance-account" label={row.label} value={balance(row.balance)} initiallyOpen={row.balance === null || row.id === portfolioToEdit}>
      <div className="finance-row"><Field label="Portfolio label"><input required maxLength={120} value={row.label} onChange={e => portfolioEdit(row, { label: e.target.value })} /></Field>
        <Amount currency={data.currency} optional label="Portfolio balance (blank = unknown)" value={row.balance} onChange={n => portfolioEdit(row, { balance: n, observedOn: observation(n) })} />
        <Field label="Portfolio balance date"><FinanceDateInput required={row.balance !== null} max={today()} value={row.observedOn ?? ''} onChange={value => portfolioEdit(row, { observedOn: value || null })} /></Field>
        <Remove label={row.label} onClick={() => onChange({ ...data, portfolios: data.portfolios.filter(r => r.id !== row.id) })} />
      </div>
      <details className="finance-details finance-investment-flows" open={row.id === portfolioToEdit || undefined}><summary>Money added & taken out · for gains</summary><InvestmentFlowsEditor currency={data.currency} portfolio={row} onChange={patch => portfolioEdit(row, patch)} /></details>
    </EditableRow>)}

    </section>
    <section className="finance-account-group" aria-labelledby="finance-loans-title">
    <header><h3 id="finance-loans-title">Loans</h3>
    <button type="button" className="finance-account-add" aria-label="+ Loan" title="Add loan" onClick={() => onChange({ ...data, debts: [...data.debts, { id: id(), label: 'Loan', balance: 0, observedOn: today(), annualRatePercent: 0, rateConvention: 'nominal', variableAssumption: false, monthlyPayment: 0, includedInBaseline: false }] })}>+</button><small>Mortgages & other borrowing</small>
    </header>
    {data.debts.map(row => <EditableRow key={row.id} className="finance-account" label={row.label} value={balance(row.balance)} note={`${formatMoney(row.monthlyPayment, data.currency, 0)} / month`} initiallyOpen={row.balance === 0}>
      <div className="finance-row">
        <Field label="Loan name"><input required value={row.label} maxLength={120} onChange={e => debtEdit(row, { label: e.target.value })} /></Field>
        <Amount currency={data.currency} label="Amount still owed" value={row.balance} onChange={n => debtEdit(row, { balance: n!, observedOn: today() })} />
        <Field label="Loan balance date"><FinanceDateInput required max={today()} value={row.observedOn} onChange={value => debtEdit(row, { observedOn: value })} /></Field>
        <Amount currency={data.currency} label="Monthly loan payment" value={row.monthlyPayment} onChange={n => debtEdit(row, { monthlyPayment: n! })} />
        <Remove label={row.label} onClick={() => onChange({ ...data, debts: data.debts.filter(r => r.id !== row.id), plan: { ...data.plan, allocations: data.plan.allocations.filter(r => r.kind !== 'debt' || r.targetId !== row.id) } })} />
      </div>
      <p className="finance-muted">The amount your lender asks for each month, before any extra repayments.</p>
      <label className="finance-check"><input type="checkbox" checked={row.includedInBaseline} onChange={e => debtEdit(row, { includedInBaseline: e.target.checked })} />Payment already included in essential spending</label>
      <details className="finance-details"><summary>Interest rate & loan details</summary>
        <div className="finance-fields">
          <NumberField label="Annual rate (%)" value={row.annualRatePercent} onChange={n => debtEdit(row, { annualRatePercent: n })} />
          <Field label="Rate type"><FinanceSelect value={row.rateConvention} onChange={value => debtEdit(row, { rateConvention: value as Debt['rateConvention'] })} options={[{ id: 'nominal', label: 'Nominal annual rate' }, { id: 'effective', label: 'Effective annual rate' }]} /></Field>
        </div>
        <p className="finance-muted">Use the rate type shown by your lender. Nominal is divided by 12; effective includes compounding across the year.</p>
        <label className="finance-check"><input type="checkbox" checked={row.variableAssumption} onChange={e => debtEdit(row, { variableAssumption: e.target.checked })} />Variable interest rate</label>
      </details>
    </EditableRow>)}

    </section>
  </div>
}
