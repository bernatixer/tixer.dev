// ============================================
// INSIGHTS PANEL — actionable "where to cut" view
// ============================================
//
// Four sections, computed straight from the transactions list (no AI):
//   1. Top merchants this month  — specific places, not categories
//   2. Biggest movers vs last month
//   3. Recurring charges detected (subscription audit)
//   4. Spend pace + forecast graph (this month vs last month, projection)

import { FC, useMemo } from 'react'
import {
  BANK_CATEGORY_COLORS,
  BANK_CATEGORY_LABEL,
  detectRecurring,
  monthOverMonthDeltas,
  topMerchantsForMonth,
  type BankTransaction,
} from '@/money/bank'
import { formatEUR } from '@/money/types'
import { SpendForecastChart } from './SpendForecastChart'

interface Props {
  transactions: BankTransaction[]
  currentMonth: string  // 'YYYY-MM'
}

export const InsightsPanel: FC<Props> = ({ transactions, currentMonth }) => {
  const topMerchants = useMemo(
    () => topMerchantsForMonth(transactions, currentMonth, 5),
    [transactions, currentMonth],
  )
  const mom = useMemo(
    () => monthOverMonthDeltas(transactions, currentMonth, 4),
    [transactions, currentMonth],
  )
  const movers = mom.deltas

  // Pretty-print "VS APR 1–18" so the user knows it's an apples-to-apples
  // comparison, not full-vs-partial.
  const previousLabel = useMemo(() => {
    const [y, m] = mom.previousMonth.split('-').map(Number)
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
    return `${monthNames[m - 1]} 1–${mom.dayLimit}, ${y}`
  }, [mom.previousMonth, mom.dayLimit])
  const recurring = useMemo(() => detectRecurring(transactions), [transactions])

  const hasAny =
    topMerchants.length > 0 ||
    movers.length > 0 ||
    recurring.length > 0 ||
    transactions.length > 0

  if (!hasAny) return null

  return (
    <section className="insights">
      <div className="insights__label">WHERE TO CUT</div>

      <div className="insights__grid">
        {/* Top merchants */}
        <div className="insights__block">
          <div className="insights__block-title">TOP MERCHANTS</div>
          {topMerchants.length === 0 ? (
            <div className="insights__empty">No expenses this month yet.</div>
          ) : (
            <div className="insights__rows">
              {topMerchants.map((m, idx) => (
                <div key={m.counterparty + idx} className="insights__row">
                  <span
                    className="insights__cat-dot"
                    style={{ background: BANK_CATEGORY_COLORS[m.category] }}
                    title={BANK_CATEGORY_LABEL[m.category]}
                  />
                  <div className="insights__row-body">
                    <span className="insights__row-name">
                      <span className="insights__rank">{idx + 1}</span>
                      {m.counterparty}
                    </span>
                    <span className="insights__row-meta">{m.count} visit{m.count === 1 ? '' : 's'}</span>
                  </div>
                  <span className="insights__row-amt">{formatEUR(m.amountCents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Month-over-month movers */}
        <div className="insights__block">
          <div className="insights__block-title">
            VS {previousLabel}
          </div>
          {movers.length === 0 ? (
            <div className="insights__empty">
              No notable changes — or no last-month data yet.
            </div>
          ) : (
            <div className="insights__rows">
              {movers.map((d) => {
                const up = d.diffCents > 0
                const pctText =
                  d.diffPct === null
                    ? d.previousCents === 0
                      ? 'new'
                      : '—'
                    : `${up ? '+' : ''}${Math.round(d.diffPct * 100)}%`
                return (
                  <div key={d.category} className="insights__row">
                    <span
                      className="insights__cat-dot"
                      style={{ background: BANK_CATEGORY_COLORS[d.category] }}
                    />
                    <div className="insights__row-body">
                      <span className="insights__row-name">
                        {BANK_CATEGORY_LABEL[d.category]}
                      </span>
                      <span className="insights__row-meta">
                        {formatEUR(d.previousCents)} → {formatEUR(d.currentCents)}
                      </span>
                    </div>
                    <span className={`insights__row-amt ${up ? 'is-up' : 'is-down'}`}>
                      {up ? '↑' : '↓'} {pctText}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recurring */}
        <div className="insights__block">
          <div className="insights__block-title">
            RECURRING · {recurring.length}
          </div>
          {recurring.length === 0 ? (
            <div className="insights__empty">
              None detected yet — needs ≥2 occurrences ~30d apart.
            </div>
          ) : (
            <div className="insights__rows">
              {recurring.slice(0, 8).map((r) => (
                <div key={r.counterparty} className="insights__row">
                  <span
                    className="insights__cat-dot"
                    style={{ background: BANK_CATEGORY_COLORS[r.category] }}
                  />
                  <div className="insights__row-body">
                    <span className="insights__row-name">{r.counterparty}</span>
                    <span className="insights__row-meta">
                      {r.occurrences}× · every {r.avgIntervalDays}d
                    </span>
                  </div>
                  <span className="insights__row-amt">
                    {formatEUR(r.monthlyCents)}<span className="insights__per">/mo</span>
                  </span>
                </div>
              ))}
              {recurring.length > 8 && (
                <div className="insights__row insights__row--more">
                  +{recurring.length - 8} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <SpendForecastChart transactions={transactions} currentMonth={currentMonth} />
    </section>
  )
}
