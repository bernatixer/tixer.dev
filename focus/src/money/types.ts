// ============================================
// MONEY — TYPES, CATEGORIES, FORMATTERS
// ============================================

export type Cadence = 'monthly' | 'quarterly' | 'yearly' | 'weekly'

export type Category =
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
  | 'other'  // system fallback — surfaced as "Uncategorized" in the UI

export interface Income {
  id: string
  label: string
  amountCents: number      // amount in the entry's own cadence
  cadence: Cadence
  createdAt: string
}

export interface Expense {
  id: string
  label: string
  amountCents: number
  cadence: Cadence
  category: Category
  createdAt: string
}

export type IncomeCreate = Omit<Income, 'id' | 'createdAt'>
export type ExpenseCreate = Omit<Expense, 'id' | 'createdAt'>

export interface MoneySnapshot {
  incomes: Income[]
  expenses: Expense[]
}

// ============================================
// CATEGORY CONFIG
// ============================================

interface CategoryConfig {
  id: Category
  label: string
  color: string
}

export const CATEGORIES: readonly CategoryConfig[] = [
  { id: 'housing',    label: 'Housing',       color: '#4ECDC4' },
  { id: 'transport',  label: 'Transport',     color: '#FF9500' },
  { id: 'food',       label: 'Food',          color: '#FFD166' },
  { id: 'clothing',   label: 'Clothing',      color: '#A78BFA' },
  { id: 'beauty',     label: 'Beauty',        color: '#EC4899' },
  { id: 'decoration', label: 'Decoration',    color: '#DDA15E' },
  { id: 'fitness',    label: 'Fitness',       color: '#F06292' },
  { id: 'travel',     label: 'Travel',        color: '#5BC0EB' },
  { id: 'leisure',    label: 'Leisure',       color: '#81C784' },
  { id: 'gifts',      label: 'Gifts',         color: '#FFB347' },
  { id: 'investment', label: 'Investment',    color: '#7CFFB8' },
  { id: 'other',      label: 'Uncategorized', color: '#888888' },
] as const

export const CATEGORY_BY_ID: Record<Category, CategoryConfig> = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c]),
) as Record<Category, CategoryConfig>

export const SAVINGS_COLOR = '#BFFF00'   // var(--acid)
export const OVERSPEND_COLOR = '#FF4444' // priority-urgent

// ============================================
// CADENCE NORMALIZATION
// ============================================

const CADENCE_MULTIPLIER_TO_MONTHLY: Record<Cadence, number> = {
  monthly: 1,
  weekly: 52 / 12,      // ~4.333
  quarterly: 1 / 3,
  yearly: 1 / 12,
}

export const toMonthlyCents = (amountCents: number, cadence: Cadence): number =>
  Math.round(amountCents * CADENCE_MULTIPLIER_TO_MONTHLY[cadence])

export const toYearlyCents = (amountCents: number, cadence: Cadence): number =>
  toMonthlyCents(amountCents, cadence) * 12

// ============================================
// EUR FORMATTING
// ============================================

// Stored in cents (integer). Formatters work in whole euros for the
// dashboard view — cents add noise at the macro level.
const EUR_ROUND = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const EUR_PRECISE = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatEUR = (cents: number): string => EUR_ROUND.format(Math.round(cents / 100))

export const formatEURPrecise = (cents: number): string => EUR_PRECISE.format(cents / 100)

export const parseEUR = (text: string): number | null => {
  // accept "1234,56" / "1.234,56" / "1234.56" / "1234"
  const cleaned = text.trim().replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '')
  const dotForm = cleaned.replace(',', '.')
  const n = Number(dotForm)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

// ============================================
// AGGREGATIONS
// ============================================

export const monthlyTotal = <T extends { amountCents: number; cadence: Cadence }>(items: T[]): number =>
  items.reduce((sum, item) => sum + toMonthlyCents(item.amountCents, item.cadence), 0)

export interface CategoryBreakdown {
  category: Category
  monthlyCents: number
  count: number
  items: Expense[]
}

export const groupByCategory = (expenses: Expense[]): CategoryBreakdown[] => {
  const buckets = new Map<Category, CategoryBreakdown>()
  for (const e of expenses) {
    const monthlyCents = toMonthlyCents(e.amountCents, e.cadence)
    const existing = buckets.get(e.category)
    if (existing) {
      existing.monthlyCents += monthlyCents
      existing.count += 1
      existing.items.push(e)
    } else {
      buckets.set(e.category, {
        category: e.category,
        monthlyCents,
        count: 1,
        items: [e],
      })
    }
  }
  return [...buckets.values()].sort((a, b) => b.monthlyCents - a.monthlyCents)
}

