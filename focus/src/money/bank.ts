// ============================================
// BANK INTEGRATION — frontend types
// ============================================

export type BankSessionStatus = 'active' | 'expired' | 'revoked'

export interface BankSession {
  id: string
  ebSessionId: string
  aspspName: string
  aspspCountry: string
  status: BankSessionStatus
  authorizedAt: string
  validUntil: string
  createdAt: string
}

export interface BankAccount {
  id: string
  sessionId: string
  ebAccountUid: string
  name: string | null
  ibanMasked: string | null
  currency: string
  lastSyncedAt: string | null
  createdAt: string
}

export type BankCategory =
  | 'housing'
  | 'transport'
  | 'food'
  | 'clothing'
  | 'beauty'
  | 'decoration'
  | 'fitness'
  | 'travel'
  | 'leisure'
  | 'gifts'
  | 'investment'
  // System-only categories (not in the user-facing picker):
  | 'income'   // historical/legacy value; analytics derive income from sign now
  | 'transfer' // internal flows; excluded from analytics
  | 'other'    // default for any transaction not yet categorized by the user

export type BankCategorySource = 'derived' | 'ai' | 'manual'

export interface BankTransaction {
  id: string
  accountId: string
  ebTransactionId: string
  bookingDate: string
  valueDate: string | null
  amountCents: number              // original from bank (negative = outflow)
  userAmountCents: number | null   // user override for splits/reimbursements
  currency: string
  counterparty: string | null
  description: string | null
  category: BankCategory
  categorySource: BankCategorySource
  excluded: boolean                // hidden from analytics but visible in table
  spreadMonths: number | null      // amortize over N months from bookingDate
  createdAt: string
}

// Effective amount for aggregations — prefers user override when set.
export const effectiveAmountCents = (tx: BankTransaction): number =>
  tx.userAmountCents ?? tx.amountCents

// id-prefix sentinels we use when a manual income/expense is rendered
// inside the bank-transactions table.
export const MANUAL_INCOME_PREFIX = 'manual-inc-'
export const MANUAL_EXPENSE_PREFIX = 'manual-exp-'

export const isManualRowId = (id: string): boolean =>
  id.startsWith(MANUAL_INCOME_PREFIX) || id.startsWith(MANUAL_EXPENSE_PREFIX)

export interface BankStatus {
  configured: boolean
  app?: {
    name: string
    environment: 'SANDBOX' | 'PRODUCTION'
    active: boolean
    countries: string[]
    services: string[]
  }
  error?: string
}

export interface SyncResult {
  accountId: string
  newTransactions: number
  totalSeen: number
  lastSyncedAt: string
}

// ============================================
// HELPERS
// ============================================

export const formatTxAmount = (cents: number, currency: string): string => {
  const sign = cents < 0 ? '−' : '+'
  const value = Math.abs(cents) / 100
  const formatted = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `${sign}${formatted}`
}

export const daysUntilExpiry = (validUntil: string): number => {
  const ms = new Date(validUntil).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / 86400_000))
}

// Renders a YYYY-MM-DD as "Mon 17" / "Tue 18" / etc. — short weekday + day.
const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

export const formatTxDate = (iso: string): { weekday: string; date: string } => {
  if (!iso || iso === '—') return { weekday: '', date: iso }
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return { weekday: '', date: iso }
  const date = new Date(y, m - 1, d)
  return { weekday: WEEKDAY_SHORT[date.getDay()], date: iso }
}

// ============================================
// CATEGORY → DISPLAY
// ============================================
//
// Bank categories include `income` and `transfer` which aren't in the
// 9-category expense palette. We surface income separately and exclude
// transfers from totals (they shuffle money between own accounts).

import { toMonthlyCents as monthlyCentsOf } from './types'
import type { Category, Expense, Income } from './types'

// ============================================
// MANUAL ENTRY → BankTransaction adapter
// ============================================
//
// The transactions table wants a single row shape. We synthesize a
// BankTransaction-looking object per manual income/expense so the same
// renderer (and filter logic) works for both. The id carries a sentinel
// prefix so the click handler can route to the right edit modal.

const CATEGORY_TO_BANK: Record<Category, BankCategory> = {
  housing: 'housing',
  transport: 'transport',
  food: 'food',
  clothing: 'clothing',
  beauty: 'beauty',
  decoration: 'decoration',
  fitness: 'fitness',
  travel: 'travel',
  leisure: 'leisure',
  gifts: 'gifts',
  investment: 'investment',
  other: 'other',
}

export const manualEntriesAsTransactions = (
  incomes: Income[],
  expenses: Expense[],
): BankTransaction[] => {
  const rows: BankTransaction[] = []
  for (const i of incomes) {
    rows.push({
      id: MANUAL_INCOME_PREFIX + i.id,
      accountId: '',
      ebTransactionId: '',
      bookingDate: i.createdAt.slice(0, 10) || '—',
      valueDate: null,
      amountCents: monthlyCentsOf(i.amountCents, i.cadence),
      userAmountCents: null,
      currency: 'EUR',
      counterparty: i.label,
      description: `Manual · ${i.cadence}`,
      category: 'income',
      categorySource: 'manual',
      excluded: false,
      spreadMonths: null,
      createdAt: i.createdAt,
    })
  }
  for (const e of expenses) {
    rows.push({
      id: MANUAL_EXPENSE_PREFIX + e.id,
      accountId: '',
      ebTransactionId: '',
      bookingDate: e.createdAt.slice(0, 10) || '—',
      valueDate: null,
      amountCents: -monthlyCentsOf(e.amountCents, e.cadence),
      userAmountCents: null,
      currency: 'EUR',
      counterparty: e.label,
      description: `Manual · ${e.cadence}`,
      category: CATEGORY_TO_BANK[e.category],
      categorySource: 'manual',
      excluded: false,
      spreadMonths: null,
      createdAt: e.createdAt,
    })
  }
  return rows
}

export const BANK_CATEGORY_COLORS: Record<BankCategory, string> = {
  housing: '#4ECDC4',
  transport: '#FF9500',
  food: '#FFD166',
  clothing: '#A78BFA',
  beauty: '#EC4899',
  decoration: '#DDA15E',
  fitness: '#F06292',
  travel: '#5BC0EB',
  leisure: '#81C784',
  gifts: '#FFB347',
  investment: '#7CFFB8',
  income: '#BFFF00',
  transfer: '#666666',
  other: '#888888',
}

export const BANK_CATEGORY_LABEL: Record<BankCategory, string> = {
  housing: 'Housing',
  transport: 'Transport',
  food: 'Food',
  clothing: 'Clothing',
  beauty: 'Beauty',
  decoration: 'Decoration',
  fitness: 'Fitness',
  travel: 'Travel',
  leisure: 'Leisure',
  gifts: 'Gifts',
  investment: 'Investment',
  income: 'Income',
  transfer: 'Transfer',
  other: 'Uncategorized',
}

// Maps the broader BankCategory back to the narrower expense Category.
// Returns null for non-expense buckets (income, transfer) — investments
// count as expenses (they leave the spending pool).
const TO_EXPENSE_CATEGORY: Partial<Record<BankCategory, Category>> = {
  housing: 'housing',
  transport: 'transport',
  food: 'food',
  clothing: 'clothing',
  beauty: 'beauty',
  decoration: 'decoration',
  fitness: 'fitness',
  travel: 'travel',
  leisure: 'leisure',
  gifts: 'gifts',
  investment: 'investment',
  other: 'other',
}

// ============================================
// MONTHLY AGGREGATES FROM REAL BANK DATA
// ============================================

interface AggregateOpts {
  // Optional override: 'YYYY-MM'. Defaults to the user's current local month.
  month?: string
}

// Walk the transaction list and produce synthetic Income[]/Expense[]
// rows the Sankey/Donut/Stats already know how to render. Bounded by
// calendar month — from the 1st of the month through the end of the
// month (or today if we're mid-month). Manual entries are already
// monthly so they pass through untouched.
export interface BankAggregate {
  incomes: Income[]
  expenses: Expense[]
  transactionCount: number
  month: string            // 'YYYY-MM'
  monthLabel: string       // 'MAY 2026'
  monthRange: { from: string; to: string }  // YYYY-MM-DD inclusive
}

const MONTH_NAMES_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

const pad2 = (n: number) => String(n).padStart(2, '0')
const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

// How much a single transaction "counts" toward the given target month
// (YYYY-MM). For normal transactions: the full effective amount if booking
// date falls in the month, else 0. For spread transactions: amount /
// spreadMonths if the target month is within the spread window from the
// booking month, else 0. Sign of the amount is preserved.
const monthDiff = (later: string, earlier: string): number => {
  const [y1, m1] = later.split('-').map(Number)
  const [y2, m2] = earlier.split('-').map(Number)
  return (y1 - y2) * 12 + (m1 - m2)
}

const txContributionToMonth = (tx: BankTransaction, targetMonth: string): number => {
  if (tx.excluded) return 0
  const eff = effectiveAmountCents(tx)
  const spread = tx.spreadMonths && tx.spreadMonths > 1 ? tx.spreadMonths : 1
  const txMonth = tx.bookingDate.slice(0, 7)
  if (spread === 1) {
    return txMonth === targetMonth ? eff : 0
  }
  const diff = monthDiff(targetMonth, txMonth)
  if (diff < 0 || diff >= spread) return 0
  return Math.round(eff / spread)
}

// ============================================
// INSIGHT HELPERS — month deltas, recurring, forecast
// ============================================

const monthKeyOf = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`

export const currentMonthKey = (): string => monthKeyOf(new Date())

export const previousMonthKey = (key: string): string => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 - 1, 1) // m is 1-based, subtract one more
  return monthKeyOf(d)
}

// Cap day index at the actual last day of the given month (handles
// short months when projecting forward).
const lastDayOfMonth = (key: string): number => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export interface TopMerchant {
  counterparty: string
  amountCents: number       // positive number; sum of |effective| outflows
  count: number
  category: BankCategory
  lastDate: string
}

// Top expense merchants for a given month, sorted by total spend desc.
// Uses contributions (so spread transactions count their per-month slice).
export const topMerchantsForMonth = (
  transactions: BankTransaction[],
  month: string,
  limit = 5,
): TopMerchant[] => {
  const byCp = new Map<string, TopMerchant>()
  for (const tx of transactions) {
    const amount = txContributionToMonth(tx, month)
    if (amount >= 0) continue
    if (tx.category === 'transfer') continue
    // Drop rows without a real counterparty (Revolut internal flows like
    // "Exchanged to EUR" land here when not yet tagged as 'transfer').
    const name = tx.counterparty?.trim()
    if (!name || name.toLowerCase() === 'null') continue
    const key = name.toLowerCase()
    const existing = byCp.get(key)
    const date = tx.bookingDate
    if (existing) {
      existing.amountCents += Math.abs(amount)
      existing.count += 1
      if (date > existing.lastDate) existing.lastDate = date
    } else {
      byCp.set(key, {
        counterparty: name,
        amountCents: Math.abs(amount),
        count: 1,
        category: tx.category,
        lastDate: date,
      })
    }
  }
  return [...byCp.values()]
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, limit)
}

export interface CategoryDelta {
  category: BankCategory
  currentCents: number
  previousCents: number
  diffCents: number              // positive = up, negative = down
  diffPct: number | null         // null when previous is 0
}

export interface MonthOverMonthResult {
  deltas: CategoryDelta[]
  currentMonth: string
  previousMonth: string
  // Day-of-month boundary used for the apples-to-apples comparison
  // (e.g. 18 means we compared days 1–18 of both months).
  dayLimit: number
}

// Sum of bank-booked expenses by category for a given month, up to (and
// including) the given day-of-month. Used for partial-month vs full-month
// comparisons. We deliberately ignore `spread_months` here — MoM is about
// actual cash outflows on actual dates, not budget allocations.
const expenseTotalsByCategoryUpToDay = (
  transactions: BankTransaction[],
  month: string,
  dayLimit: number,
): Map<BankCategory, number> => {
  const map = new Map<BankCategory, number>()
  const cutoff = `${month}-${pad2(dayLimit)}`
  for (const tx of transactions) {
    if (tx.excluded) continue
    if (tx.category === 'transfer') continue
    if (!tx.bookingDate.startsWith(month)) continue
    if (tx.bookingDate > cutoff) continue
    const eff = effectiveAmountCents(tx)
    if (eff >= 0) continue
    map.set(tx.category, (map.get(tx.category) ?? 0) + Math.abs(eff))
  }
  return map
}

export const monthOverMonthDeltas = (
  transactions: BankTransaction[],
  currentMonth: string,
  limit = 4,
): MonthOverMonthResult => {
  const previousMonth = previousMonthKey(currentMonth)
  const isCurrent = currentMonth === currentMonthKey()
  const today = new Date().getDate()
  const lastDayCur = lastDayOfMonth(currentMonth)
  const lastDayPrev = lastDayOfMonth(previousMonth)
  // For the current month, only go up to today. For past months, compare
  // entire months. Cap by each month's actual length (so Feb-29-comparison
  // works against a 31-day month).
  const dayLimit = isCurrent
    ? Math.min(today, lastDayCur, lastDayPrev)
    : Math.min(lastDayCur, lastDayPrev)

  const cur = expenseTotalsByCategoryUpToDay(transactions, currentMonth, dayLimit)
  const prev = expenseTotalsByCategoryUpToDay(transactions, previousMonth, dayLimit)
  const cats = new Set<BankCategory>([...cur.keys(), ...prev.keys()])
  const deltas: CategoryDelta[] = []
  for (const c of cats) {
    // 'other' is a categorization state, not a real expense category —
    // showing "Uncategorized ↓ -100%" is almost always "I triaged it",
    // not "I spent less". Drop it from this view.
    if (c === 'other') continue
    const currentCents = cur.get(c) ?? 0
    const previousCents = prev.get(c) ?? 0
    const diffCents = currentCents - previousCents
    if (Math.abs(diffCents) < 500) continue // skip <5€ noise
    const diffPct = previousCents > 0 ? diffCents / previousCents : null
    deltas.push({ category: c, currentCents, previousCents, diffCents, diffPct })
  }
  deltas.sort((a, b) => Math.abs(b.diffCents) - Math.abs(a.diffCents))
  return {
    deltas: deltas.slice(0, limit),
    currentMonth,
    previousMonth,
    dayLimit,
  }
}

export interface RecurringHit {
  counterparty: string
  category: BankCategory
  meanCents: number              // average per occurrence
  monthlyCents: number           // average / typical-interval-in-months
  occurrences: number
  firstDate: string
  lastDate: string
  avgIntervalDays: number
}

// Cheap recurring detector: same merchant, similar amount (±20%), inter-tx
// interval averaging 25–40 days, at least 2 occurrences. Picks up monthly
// utility bills, subscriptions, weekly/biweekly payments don't qualify.
export const detectRecurring = (
  transactions: BankTransaction[],
  opts: { intervalMin?: number; intervalMax?: number; amountTolerance?: number } = {},
): RecurringHit[] => {
  const intervalMin = opts.intervalMin ?? 25
  const intervalMax = opts.intervalMax ?? 40
  const tolerance = opts.amountTolerance ?? 0.2

  const groups = new Map<string, BankTransaction[]>()
  for (const tx of transactions) {
    if (tx.excluded) continue
    if (tx.category === 'transfer') continue
    const eff = effectiveAmountCents(tx)
    if (eff >= 0) continue                       // expenses only
    const cp = tx.counterparty?.trim()
    if (!cp) continue
    const key = cp.toLowerCase()
    const list = groups.get(key) ?? []
    list.push(tx)
    groups.set(key, list)
  }

  const hits: RecurringHit[] = []
  for (const [, txs] of groups.entries()) {
    if (txs.length < 2) continue
    const sorted = [...txs].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))
    const amounts = sorted.map((t) => Math.abs(effectiveAmountCents(t)))
    const mean = amounts.reduce((s, x) => s + x, 0) / amounts.length

    // Filter to occurrences within tolerance of the mean
    const withinTolerance = sorted.filter(
      (_t, i) => Math.abs(amounts[i] - mean) / mean <= tolerance,
    )
    if (withinTolerance.length < 2) continue

    // Compute inter-occurrence intervals (days)
    const dates = withinTolerance.map((t) => new Date(t.bookingDate).getTime())
    const intervals: number[] = []
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / 86400_000)
    }
    if (intervals.length === 0) continue
    const avgInterval = intervals.reduce((s, x) => s + x, 0) / intervals.length
    if (avgInterval < intervalMin || avgInterval > intervalMax) continue

    const filteredMean =
      withinTolerance.map((t) => Math.abs(effectiveAmountCents(t))).reduce((s, x) => s + x, 0) /
      withinTolerance.length
    // The detector only catches roughly-monthly cycles (25–40 day window),
    // so the per-occurrence amount IS the monthly figure. Don't divide by
    // (avgInterval/30) — that inflates a 600 € rent to 610 €/mo just
    // because February is short, which is confusing.
    const monthlyCents = Math.round(filteredMean)

    hits.push({
      counterparty: withinTolerance[0].counterparty!.trim(),
      category: withinTolerance[withinTolerance.length - 1].category,
      meanCents: Math.round(filteredMean),
      monthlyCents,
      occurrences: withinTolerance.length,
      firstDate: withinTolerance[0].bookingDate,
      lastDate: withinTolerance[withinTolerance.length - 1].bookingDate,
      avgIntervalDays: Math.round(avgInterval),
    })
  }
  return hits.sort((a, b) => b.monthlyCents - a.monthlyCents)
}

export interface DayPoint {
  day: number              // 1..31
  cumulativeCents: number  // running expense total (positive number)
}

// Cumulative daily spend in a given month. Used to plot the forecast.
// Treats spreads as their per-month slice but drops it on the booking day
// (we don't have intra-month granularity for amortized parts).
export const cumulativeSpendByDay = (
  transactions: BankTransaction[],
  month: string,
): DayPoint[] => {
  const days = lastDayOfMonth(month)
  const perDay = new Array<number>(days + 1).fill(0)
  for (const tx of transactions) {
    if (tx.excluded) continue
    if (tx.category === 'transfer') continue
    const amount = txContributionToMonth(tx, month)
    if (amount >= 0) continue
    const txMonth = tx.bookingDate.slice(0, 7)
    // For spread transactions, drop the per-month slice on the FIRST day
    // of the target month if booking is in the past, else on the booking
    // day. Keeps the cumulative monotonic in a sensible way.
    let day: number
    if (txMonth === month) {
      day = Number(tx.bookingDate.slice(8, 10))
    } else {
      day = 1
    }
    if (day < 1 || day > days) continue
    perDay[day] += Math.abs(amount)
  }
  const out: DayPoint[] = []
  let running = 0
  for (let d = 1; d <= days; d++) {
    running += perDay[d]
    out.push({ day: d, cumulativeCents: running })
  }
  return out
}

export interface MonthForecast {
  daysElapsed: number
  daysInMonth: number
  spentSoFarCents: number
  dailyRateCents: number
  projectedTotalCents: number
}

export const forecastMonth = (
  transactions: BankTransaction[],
  month: string,
): MonthForecast => {
  const daysInMonth = lastDayOfMonth(month)
  const now = new Date()
  const isCurrent = month === currentMonthKey()
  const daysElapsed = isCurrent ? Math.min(now.getDate(), daysInMonth) : daysInMonth
  const points = cumulativeSpendByDay(transactions, month)
  const spentSoFar = points[Math.max(0, daysElapsed - 1)]?.cumulativeCents ?? 0
  const dailyRate = daysElapsed > 0 ? spentSoFar / daysElapsed : 0
  return {
    daysElapsed,
    daysInMonth,
    spentSoFarCents: spentSoFar,
    dailyRateCents: Math.round(dailyRate),
    projectedTotalCents: Math.round(dailyRate * daysInMonth),
  }
}

export const aggregateBankToMonthly = (
  transactions: BankTransaction[],
  opts: AggregateOpts = {},
): BankAggregate => {
  // Resolve the target month.
  const now = new Date()
  let year: number, monthIdx: number
  if (opts.month) {
    const [y, m] = opts.month.split('-').map(Number)
    year = y
    monthIdx = m - 1
  } else {
    year = now.getFullYear()
    monthIdx = now.getMonth()
  }
  const firstDay = new Date(year, monthIdx, 1)
  const lastDayOfMonth = new Date(year, monthIdx + 1, 0)
  const isCurrentMonth =
    year === now.getFullYear() && monthIdx === now.getMonth()
  const lastDay = isCurrentMonth ? now : lastDayOfMonth
  const fromIso = isoLocal(firstDay)
  const toIso = isoLocal(lastDay)
  const monthKey = `${year}-${pad2(monthIdx + 1)}`
  const monthLabel = `${MONTH_NAMES_SHORT[monthIdx]} ${year}`

  // Pair every transaction with its contribution to the target month.
  // Spread transactions contribute even if their booking date is outside
  // the month, so we walk the full list rather than pre-filtering by date.
  const contributions = transactions
    .map((t) => ({ tx: t, amount: txContributionToMonth(t, monthKey) }))
    .filter((c) => c.amount !== 0)

  // For row counts, anything that contributed (spread or not) counts.
  // For the legacy "did this tx happen in this month" we still need the
  // booking-date check elsewhere if needed, but for the aggregate this
  // is the right number.
  const transactionCount = contributions.length

  // Income: any positive contribution that isn't a transfer. The category
  // value doesn't gate this anymore — the sign of the amount does. This
  // matches the user's mental model: money in = income, no tagging needed.
  const incomeByCp = new Map<string, number>()
  for (const { tx, amount } of contributions) {
    if (amount <= 0) continue
    if (tx.category === 'transfer') continue
    const key = tx.counterparty?.trim() || 'Other income'
    incomeByCp.set(key, (incomeByCp.get(key) ?? 0) + amount)
  }
  const incomes: Income[] = [...incomeByCp.entries()].map(([label, cents]) => ({
    id: `bank-inc-${label}`,
    label,
    amountCents: cents,
    cadence: 'monthly',
    createdAt: '',
  }))

  // Expenses: sum debits by category. Skip transfers/income.
  const expByCat = new Map<Category, number>()
  for (const { tx, amount } of contributions) {
    if (amount >= 0) continue
    const mapped = TO_EXPENSE_CATEGORY[tx.category]
    if (!mapped) continue
    expByCat.set(mapped, (expByCat.get(mapped) ?? 0) + Math.abs(amount))
  }
  const expenses: Expense[] = [...expByCat.entries()].map(([cat, cents]) => ({
    id: `bank-exp-${cat}`,
    label: cat[0].toUpperCase() + cat.slice(1),
    amountCents: cents,
    cadence: 'monthly',
    category: cat,
    createdAt: '',
  }))

  return {
    incomes,
    expenses,
    transactionCount,
    month: monthKey,
    monthLabel,
    monthRange: { from: fromIso, to: toIso },
  }
}
