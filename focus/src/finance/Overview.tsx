import { useState } from 'react'
import { calculateInvestment, calculateOverview, monthlyBreakdown } from './calculations'
import { formatDate, formatMoney, formatNumber, formatPercent, type FinanceData } from './model'
import { FinanceTooltip } from './FinanceControls'
import { GrowthPanel } from './Simulator'
import './overview.css'

export function Overview({ data, onEditAccounts }: {
  data: FinanceData; onEditAccounts?: (portfolioId?: string) => void
}) {
  const overview = calculateOverview(data)
  const money = (amount: number) => formatMoney(amount, data.currency, 0)
  const [activeAsset, setActiveAsset] = useState<string | null>(null)
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [costsOpen, setCostsOpen] = useState(false)
  const monthly = monthlyBreakdown(data)
  const monthlyMoney = (amount: number) => formatMoney(amount, data.currency, amount % 100 === 0 ? 0 : 2)
  const regularMonthly = Math.round(data.income.regularAmount * data.income.paymentsPerYear / 12)
  const extraMonthly = overview.incomeMonthly - regularMonthly
  const incomeHint = `${money(data.income.regularAmount)} × ${data.income.paymentsPerYear} payments ÷ 12 ≈ ${money(regularMonthly)}/month.${extraMonthly > 0 ? ` Extra income adds ${money(extraMonthly)}/month on average.` : ''}`
  const colors = ['#4ecdc4', '#b79ae6', '#c4ff00', '#f0b56b', '#75a7f7', '#e88ca9', '#a9b6b3']
  const assets = [
    ...data.cash.map(row => ({ ...row, kind: 'Cash' as const })),
    ...data.portfolios.map(row => ({ ...row, kind: 'Investment' as const })),
  ].map((row, index) => ({ ...row, color: colors[index % colors.length] }))
    .sort((left, right) => (right.balance ?? -1) - (left.balance ?? -1))
  // boffin: Shares use known assets only; unknown balances and loans never become chart slices.
  const assetTotal = overview.cashTotal + overview.portfolioTotal
  const incompleteAssets = assets.some(row => row.balance === null)
  let offset = 0
  const slices = assets.map(row => {
    const share = assetTotal > 0 && row.balance !== null ? row.balance / assetTotal * 100 : 0
    const start = offset; offset += share
    return { ...row, share, start }
  })
  const cashParts = [
    { id: 'emergency', label: 'Emergency savings', amount: overview.reserveHeld, color: '#4ecdc4' },
    ...data.cash.flatMap(account => account.earmarks.filter(mark => mark.purpose !== 'emergency' && mark.amount > 0)
      .map(mark => ({ id: `${account.id}-${mark.id}`, label: `${mark.label} · ${account.label}`, amount: mark.amount, color: '#b79ae6' }))),
    { id: 'available', label: 'Available cash', amount: overview.unearmarkedCash, color: '#969da7' },
  ]
  const selectedAsset = slices.find(row => row.id === activeAsset)
  const hasInvestments = data.portfolios.length > 0
  const hasWithdrawals = data.portfolios.some(row => (row.totalWithdrawals ?? 0) > 0)

  return <>
    {overview.missingObservations.length > 0 && <aside className="finance-notice">
      <p>Balance not entered: {overview.missingObservations.join(', ')}. Totals are incomplete; an unknown balance is not zero.</p>
    </aside>}

    <article className="finance-card finance-assets">
      <div className="finance-card-heading"><span className="finance-eyebrow">YOUR ACCOUNTS</span></div>
      {assets.length === 0 ? <p>Add your first account to see the breakdown.</p> : <div className="finance-assets__layout">
        <div className="finance-assets__chart"><div className="finance-assets__donut" onPointerLeave={() => setActiveAsset(null)}>
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="43" fill="none" stroke="var(--border-default)" strokeWidth="22" />
            {slices.filter(row => row.share > 0).map(row => <circle key={row.id} cx="60" cy="60" r="43" fill="none" stroke={row.color} strokeWidth="22" pathLength="100" strokeDasharray={`${row.share} ${100 - row.share}`} strokeDashoffset={-row.start} transform="rotate(-90 60 60)"
              role="img" tabIndex={0} aria-label={`${row.label}: ${money(row.balance!)}, ${formatPercent(row.share)}`}
              opacity={activeAsset && activeAsset !== row.id ? .35 : 1}
              onPointerEnter={() => setActiveAsset(row.id)} onPointerDown={() => setActiveAsset(row.id)} onFocus={() => setActiveAsset(row.id)} onBlur={() => setActiveAsset(null)} />)}
            {slices.filter(row => row.share >= 8).map(row => {
              const angle = (row.start + row.share / 2) / 100 * Math.PI * 2 - Math.PI / 2
              return <text key={row.id} x={60 + Math.cos(angle) * 43} y={60 + Math.sin(angle) * 43} textAnchor="middle" dominantBaseline="central">{formatNumber(row.share, 0)}%</text>
            })}
          </svg>
          <div><small>{selectedAsset?.label ?? (incompleteAssets ? 'Known assets' : 'Total assets')}</small><strong>{money(selectedAsset?.balance ?? assetTotal)}</strong>{selectedAsset && <small>{formatPercent(selectedAsset.share)}</small>}</div>
        </div></div>
        <div className="finance-assets__accounts">
          <div className="finance-table-scroll"><table aria-label="Accounts" className={hasInvestments ? 'finance-assets__table--investments' : undefined}><thead><tr>
            <th scope="col">Account</th><th scope="col">Balance</th><th scope="col">Share</th>
            {hasInvestments && <><th scope="col">Money added</th>{hasWithdrawals && <th scope="col">Taken out</th>}<th scope="col">Gain / loss</th></>}
          </tr></thead>
            <tbody>{slices.map(row => {
              // boffin: Cash has no investment return; keep its flow and gain cells inapplicable.
              const result = row.kind === 'Investment' ? calculateInvestment(row) : null
              const missing = row.balance === null ? 'Add balance' : 'Add contributions'
              return <tr key={row.id} className={activeAsset === row.id ? 'finance-assets__row--active' : undefined}>
                <th scope="row"><i style={{ background: row.color }} aria-hidden="true" /><span>{row.label}<small>{row.kind}</small></span></th>
                <td>{row.balance === null ? 'Unknown' : money(row.balance)}</td>
                <td>{row.balance === null || assetTotal === 0 ? '—' : <span className="finance-assets__share">{formatPercent(row.share)}</span>}</td>
                {hasInvestments && <>
                  <td>{row.kind === 'Investment' && row.totalContributions !== null ? money(row.totalContributions) : '—'}</td>
                  {hasWithdrawals && <td>{row.kind === 'Investment' ? money(row.totalWithdrawals ?? 0) : '—'}</td>}
                  <td className={result?.gain == null ? '' : result.gain < 0 ? 'finance-danger' : 'finance-assets__gain'}>
                    {!result ? '—' : result.gain === null ? onEditAccounts ? <button type="button" className="finance-assets__complete" aria-label={`${missing} for ${row.label}`} onClick={() => onEditAccounts(row.id)}>{missing}</button> : <span>{missing}</span> : <>{result.gain > 0 ? '+' : ''}{money(result.gain)}{result.gainPercent !== null && <small>{formatPercent(result.gainPercent)}</small>}</>}
                  </td>
                </>}
              </tr>
            })}</tbody>
          </table></div>
          {incompleteAssets && <p className="finance-muted">Shares use known balances only.</p>}
        </div>
      </div>}
      {overview.debtTotal > 0 && <div className="finance-assets__totals"><span>Loans left to repay <strong>{money(overview.debtTotal)}</strong></span></div>}
    </article>

    {assets.length > 0 && <GrowthPanel data={data} />}

    <div className="finance-columns finance-overview-columns">
      <article className="finance-card">
        <span className="finance-eyebrow">YOUR CASH</span>
        <div className="finance-cash-breakdown">
          {overview.cashTotal > 0 && <div className="finance-cash-breakdown__bar">{cashParts.filter(part => part.amount > 0).map(part => <FinanceTooltip key={part.id} role="img"
            label={`${part.label}: ${money(part.amount)}, ${formatPercent(part.amount / overview.cashTotal * 100)}`}
            text={`${part.label} · ${money(part.amount)} · ${formatPercent(part.amount / overview.cashTotal * 100)}`}
            style={{ width: `${part.amount / overview.cashTotal * 100}%`, background: part.color }}>{part.amount / overview.cashTotal >= .12 && formatPercent(part.amount / overview.cashTotal * 100)}</FinanceTooltip>)}</div>}
          <dl>{cashParts.map(part => <div key={part.id}><dt><i style={{ background: part.color }} aria-hidden="true" />{part.label}</dt><dd>{money(part.amount)}<small>{overview.cashTotal > 0 ? formatPercent(part.amount / overview.cashTotal * 100) : '—'}</small></dd></div>)}</dl>
          <p>Included in your balances. {onEditAccounts && <button type="button" className="finance-text-button" onClick={() => onEditAccounts()}>Set aside money in Accounts</button>}</p>
        </div>
      </article>

      <article className="finance-card finance-monthly">
        <div className="finance-card-heading"><span className="finance-eyebrow">MONTHLY</span></div>
        <table className="finance-monthly__table" aria-label="Monthly budget"><tbody>
          <tr><th scope="row">{monthly.income.length > 1 ? <button type="button" className="finance-monthly__toggle" aria-label="Income" aria-expanded={incomeOpen} aria-controls="finance-income-breakdown" onClick={() => setIncomeOpen(!incomeOpen)}>Income</button> : data.income.paymentsPerYear === 12 ? 'Income' : <FinanceTooltip text={incomeHint} label={`Income: ${incomeHint}`}>Income</FinanceTooltip>}</th><td>{monthlyMoney(overview.incomeMonthly)}</td></tr>
          {monthly.income.length > 1 && <tr hidden={!incomeOpen} id="finance-income-breakdown" className="finance-monthly__detail"><td colSpan={2}><dl>{monthly.income.map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{monthlyMoney(row.amount)}</dd></div>)}</dl></td></tr>}
          <tr className="finance-monthly__cost"><th scope="row"><button type="button" className="finance-monthly__toggle" aria-label="Costs" aria-expanded={costsOpen} aria-controls="finance-costs-breakdown" onClick={() => setCostsOpen(!costsOpen)}>Costs</button></th><td>− {monthlyMoney(overview.expensesMonthly + overview.additionalDebtMonthly)}</td></tr>
          <tr hidden={!costsOpen} id="finance-costs-breakdown" className="finance-monthly__detail"><td colSpan={2}>{monthly.costs.length === 0 ? <p>No costs yet.</p> : <><dl>{monthly.costs.map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{monthlyMoney(row.amount)}</dd></div>)}</dl></>}</td></tr>
          <tr className="finance-monthly__total"><th scope="row">Left</th><td>{monthlyMoney(overview.surplusMonthly)}</td></tr>
        </tbody></table>
      </article>
    </div>

    <details className="finance-details"><summary>Balance history ({data.snapshots.length})</summary><p>Only recorded check-ins appear here. A change in balance is not the same as an investment return.</p><div className="finance-table-scroll"><table><caption>Balances you entered; unknown amounts make totals incomplete.</caption><thead><tr><th scope="col">Check-in</th><th scope="col">Cash</th><th scope="col">Investments</th><th scope="col">Loans</th><th scope="col">Net worth</th></tr></thead><tbody>{data.snapshots.map(snapshot => {
      const total = (rows: { balance: number | null }[]) => rows.reduce((sum, row) => sum + (row.balance ?? 0), 0)
      const cash = total(snapshot.cash), funds = total(snapshot.portfolios), debt = total(snapshot.debts)
      return <tr key={snapshot.id}><td>{formatDate(snapshot.date)}{[...snapshot.cash, ...snapshot.portfolios].some(row => row.balance === null) ? ' (incomplete)' : ''}</td>{[cash, funds, debt, cash + funds - debt].map((amount, index) => <td key={index}>{formatMoney(amount, data.currency)}</td>)}</tr>
    })}</tbody></table></div>{data.snapshots.length === 0 && <p className="finance-muted">Your first check-in will start this history.</p>}</details>
    {overview.warnings.map(warning => <aside className="finance-notice" key={warning}>{warning}</aside>)}
  </>
}
