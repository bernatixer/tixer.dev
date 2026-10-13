import { useEffect, useState, type PointerEvent } from 'react'
import { calculateOverview } from './calculations'
import { FinanceSelect } from './FinanceControls'
import { Amount, Field, NumberField } from './PlanEditor'
import { formatMoney, type FinanceData } from './model'
import { simulate, createScenario, projectionRange, type ProjectionPoint } from './simulation'
import './simulator.css'

function ProjectionChart({ points, currency }: { points: ProjectionPoint[]; currency: string }) {
  const [selected, setSelected] = useState<number | null>(null)
  useEffect(() => {
    if (selected === null) return
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null) }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [selected])
  const last = points.length - 1
  const index = Math.min(selected ?? last, last), point = points[index]
  const money = (value: number) => formatMoney(value, currency, 0)
  const { low, high } = projectionRange(points)
  const x = (month: number) => 20 + month / last * 960
  const y = (value: number) => 180 - (value - low) / (high - low) * 160
  const line = (key: 'total' | 'baseline') => points.map((row, i) => `${i ? 'L' : 'M'}${x(row.month)},${y(row[key])}`).join(' ')
  const label = (month: number) => month === 0 ? 'Today' : new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(new Date(new Date().getFullYear(), new Date().getMonth() + month, 1))
  const inspect = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setSelected(Math.max(0, Math.min(last, Math.round(((event.clientX - bounds.left) / bounds.width * 1000 - 20) / 960 * last))))
  }
  return <>
    <div className="finance-projection__legend"><span><i className="finance-projection__balance-key" />Your scenario</span><span><i className="finance-simulator__baseline-key" />Keep as is</span></div>
    <div className="finance-projection__plot" onPointerLeave={() => setSelected(null)}>
      <div className="finance-projection__scale" aria-hidden="true"><span>{money(high)}</span><span>{money((high + low) / 2)}</span><span>{money(low)}</span></div>
      <svg className="finance-projection__chart" viewBox="0 0 1000 200" preserveAspectRatio="none" role="slider" tabIndex={0}
        aria-label="Projected assets" aria-valuemin={0} aria-valuemax={last} aria-valuenow={index}
        aria-valuetext={`${label(index)}. Your scenario ${money(point.total)}. Keep as is ${money(point.baseline)}. Estimated gains ${money(point.gain)}.`}
        onFocus={() => setSelected(last)} onBlur={() => setSelected(null)}
        onKeyDown={event => {
          if (event.key === 'Escape') { setSelected(null); return }
          if (!['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
          event.preventDefault()
          setSelected(event.key === 'Home' ? 0 : event.key === 'End' ? last : Math.max(0, Math.min(last, index + (event.key === 'ArrowRight' ? 1 : -1))))
        }}
        onPointerMove={inspect} onPointerDown={inspect}>
        {[low, (high + low) / 2, high].map(value => <line key={value} x1="20" x2="980" y1={y(value)} y2={y(value)} className="finance-projection__grid" />)}
        <path d={line('baseline')} className="finance-simulator__baseline" /><path d={line('total')} className="finance-projection__balance" />
        {selected !== null && <><line x1={x(index)} x2={x(index)} y1="20" y2="180" className="finance-projection__cursor" /><circle cx={x(index)} cy={y(point.total)} r="3" className="finance-projection__balance-dot" /></>}
      </svg>
      {selected !== null && <div role="tooltip" className="finance-projection__tooltip" style={{ left: `clamp(8px, calc(74px + (100% - 74px) * ${x(index) / 1000}), calc(100% - 248px))` }}>
        <time>{label(index)}</time><span>Your scenario <strong>{money(point.total)}</strong></span><span>Keep as is <strong>{money(point.baseline)}</strong></span><span>Added <strong>{money(point.added)}</strong></span><span>Estimated gains <strong>{money(point.gain)}</strong></span>
      </div>}
    </div>
    <div className="finance-projection__dates"><span>Today</span><span>{label(last)}</span></div>
    <dl className="finance-simulator__results">{[{ label: 'Projected assets', value: points[last].total }, { label: 'Money added', value: points[last].added }, { label: 'Estimated gains', value: points[last].gain }].map(row => <div key={row.label}><dt>{row.label}</dt><dd className={row.value < 0 ? 'finance-danger' : undefined}>{money(row.value)}</dd></div>)}</dl>
  </>
}

function Simulator({ data, onReset }: { data: FinanceData; onReset: () => void }) {
  const [scenario, setScenario] = useState(() => createScenario(data))
  const [invalid, setInvalid] = useState(false)
  const [fromId, setFromId] = useState(data.cash[0]?.id ?? data.portfolios[0]?.id ?? '')
  const [toId, setToId] = useState(data.portfolios[0]?.id ?? data.cash[1]?.id ?? '')
  const [amount, setAmount] = useState<number | null>(0)
  const [transferError, setTransferError] = useState('')
  const accounts = [...data.cash, ...data.portfolios]
  const surplus = calculateOverview(data).surplusMonthly
  const money = (value: number) => formatMoney(value, data.currency, value % 100 === 0 ? 0 : 2)
  let projection: ReturnType<typeof simulate> | undefined, error = ''
  try { projection = simulate(data, scenario) } catch (failure) { error = (failure as Error).message }
  const options = accounts.map(row => ({ id: row.id, label: row.label }))
  const remaining = surplus - accounts.reduce((sum, row) => sum + (scenario.monthlyAmounts[row.id] ?? 0), 0)
  return <article className="finance-card finance-growth finance-simulator">
    <div className="finance-card-heading"><span className="finance-eyebrow">GROWTH</span><div className="finance-growth__actions">
      <FinanceSelect aria-label="Projection years" value={String(scenario.years)} onChange={value => setScenario({ ...scenario, years: Number(value) })} options={[1, 5, 10, 20, 30, 50].map(year => ({ id: String(year), label: `${year} ${year === 1 ? 'year' : 'years'}` }))} />
      <button type="button" onClick={onReset}>Reset scenario</button>
    </div></div>
    <p className="finance-muted">Allocate up to <strong>{money(surplus)}/month</strong>. Unallocated money stays as cash.</p>
    <div className="finance-simulator__accounts" onChange={event => setInvalid(Boolean(event.currentTarget.querySelector('input:invalid')))}>
      <div className="finance-simulator__columns" aria-hidden="true"><span>Account</span><span>Return / year (%)</span><span>Monthly</span><span /></div>
      {accounts.map(row => <div className="finance-simulator__account" key={row.id}>
        <div><strong>{row.label}</strong><small>Starting {row.balance === null ? 'Unknown' : money(projection?.accounts.find(account => account.id === row.id)?.start ?? row.balance)}</small></div>
        <NumberField label="Return / year (%)" inputLabel={`Annual return for ${row.label}`} value={scenario.annualReturns[row.id] ?? 0} min={-100} max={100} onChange={value => setScenario({ ...scenario, annualReturns: { ...scenario.annualReturns, [row.id]: value } })} />
        <Amount label="Monthly" inputLabel={`Monthly to ${row.label}`} value={scenario.monthlyAmounts[row.id] ?? 0} currency={data.currency} onChange={value => setScenario({ ...scenario, monthlyAmounts: { ...scenario.monthlyAmounts, [row.id]: value ?? 0 } })} />
        <button type="button" aria-label={`Use remaining for ${row.label}`} onClick={() => setScenario({ ...scenario, monthlyAmounts: { ...scenario.monthlyAmounts, [row.id]: Math.max(0, remaining + (scenario.monthlyAmounts[row.id] ?? 0)) } })}>Use remaining</button>
      </div>)}
    </div>
    <p className="finance-muted">Left as cash: <strong>{money(remaining)}/month</strong></p>
    <details className="finance-details finance-simulator__transfers"><summary>Move money now{scenario.transfers.length > 0 ? ` (${scenario.transfers.length})` : ''}</summary>
      <form className="finance-simulator__transfer" onSubmit={event => {
        event.preventDefault()
        const next = { ...scenario, transfers: [...scenario.transfers, { fromId, toId, amount: amount ?? 0 }] }
        try { simulate(data, next); setScenario(next); setTransferError(''); setAmount(0) } catch (failure) { setTransferError((failure as Error).message) }
      }}>
        <Field label="From"><FinanceSelect aria-label="Transfer from" value={fromId} onChange={setFromId} options={options} /></Field>
        <Field label="To"><FinanceSelect aria-label="Transfer to" value={toId} onChange={setToId} options={options} /></Field>
        <Amount label="Transfer amount" value={amount} currency={data.currency} onChange={setAmount} />
        <button type="submit" disabled={!amount || invalid}>Preview transfer</button>
      </form>
      {transferError && <p role="alert" className="finance-danger">{transferError}</p>}
      {scenario.transfers.map((transfer, index) => <div className="finance-simulator__move" key={index}><span>{accounts.find(row => row.id === transfer.fromId)?.label ?? 'Removed account'} → {accounts.find(row => row.id === transfer.toId)?.label ?? 'Removed account'} · {money(transfer.amount)}</span><button type="button" aria-label={`Remove transfer ${index + 1}`} onClick={() => { setScenario({ ...scenario, transfers: scenario.transfers.filter((_, i) => i !== index) }); setTransferError('') }}>Remove</button></div>)}
    </details>
    {invalid || error ? <p role="alert" className="finance-notice">{invalid ? 'Correct the highlighted amounts or rates to see your projection.' : error}</p> : projection && <ProjectionChart points={projection.points} currency={data.currency} />}
    <details className="finance-details finance-simulator__assumptions"><summary>Assumptions</summary><p>Rates start from each investment’s current gain/loss percentage, used here as an editable annual assumption. These are lifetime gains, not measured annual returns. Cash and investments without a known gain start at 0%. Returns compound monthly; contributions arrive at month end.</p><p>“Keep as is” uses the same return assumptions with today’s balances, no transfers, and all monthly surplus saved as cash at 0%. Income and costs stay constant. Figures are assets before inflation, taxes, fees or transfer costs; loans are not projected. Latest recorded balances are used, even if older than today. This preview resets when you leave Overview and never changes your saved accounts.</p></details>
  </article>
}

export function GrowthPanel({ data }: { data: FinanceData }) {
  const [reset, setReset] = useState(0)
  return <Simulator key={reset} data={data} onReset={() => setReset(value => value + 1)} />
}
