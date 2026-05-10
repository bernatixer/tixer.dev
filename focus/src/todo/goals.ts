// ============================================
// WEEKLY GOALS — TYPES & HELPERS
// ============================================

export interface WeeklyGoal {
  id: string
  weekStart: string         // ISO date YYYY-MM-DD (Monday)
  title: string
  target: number            // 1 = simple, >1 = counter
  progress: number          // 0..target
  recurring: boolean
  order: number
  createdAt: string
  completedAt: string | null
}

export type WeeklyGoalFlavor = 'simple' | 'counter'

export const goalFlavor = (g: WeeklyGoal): WeeklyGoalFlavor =>
  g.target > 1 ? 'counter' : 'simple'

export const goalProgressFraction = (g: WeeklyGoal): number => {
  if (g.target <= 0) return 0
  return Math.max(0, Math.min(1, g.progress / g.target))
}

export const isGoalComplete = (g: WeeklyGoal): boolean =>
  g.target > 0 && g.progress >= g.target

// ============================================
// WEEK BOUNDARIES
// ============================================

// Returns YYYY-MM-DD of Monday for the local week containing `date`.
// Using local time matches the user's mental model of "this week".
export const mondayOf = (date: Date): string => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export const sundayOf = (mondayIso: string): string => {
  const [y, m, d] = mondayIso.split('-').map(Number)
  const date = new Date(y, m - 1, d + 6)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export const formatWeekRange = (mondayIso: string): string => {
  const [y, m, d] = mondayIso.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`
  const endLabel = sameMonth
    ? `${end.getDate()}`
    : `${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`
  return `${startLabel} – ${endLabel}`
}

// ============================================
// CREATE PAYLOAD
// ============================================

export type WeeklyGoalCreate = Omit<WeeklyGoal, 'id' | 'createdAt' | 'completedAt'>

export interface WeeklyGoalsResponse {
  weekStart: string
  goals: WeeklyGoal[]
}
