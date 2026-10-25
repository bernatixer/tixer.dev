export interface WeightEntry { date: string; weightKg: number }
export interface Phase { startDate: string; maintenanceKcal: number; intakeKcal: number; proteinPerKg?: number | null }
export interface WeightProfile { age: number; heightCm: number; sex: 'male' | 'female'; activityFactor: number }
export interface WeightGoal { startDate: string; startWeightKg: number; targetDate: string; targetWeightKg: number }
export interface FoodDay { date: string; kcal: number | null; mealCount: number; revision: number; confirmedRevision: number | null }
// Nutrient grams are null on meals logged before they were estimated.
export interface Meal { id: string; date: string; description: string; kcal: number; proteinG?: number | null; carbsG?: number | null; fatG?: number | null; saturatedG?: number | null; fibreG?: number | null; sugarG?: number | null; createdAt: string }

// Common guidance while cutting is 1.6–2.2 g/kg; the middle keeps muscle without crowding out other food.
export const DEFAULT_PROTEIN_PER_KG = 1.8

// Energy in a kg of mixed body-weight loss; the /9 kcal-per-gram figure assumes pure fat and overstates the pace.
export const KCAL_PER_KG = 7700
const DAY_MS = 864e5

export const last = <T,>(items: T[]): T | undefined => items[items.length - 1]

export const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS
export const dateOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10)
export const localToday = () => { const now = new Date(); return dateOf(Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / DAY_MS)) }

export const phaseOn = (phases: Phase[], date: string) => last(phases.filter(phase => phase.startDate <= date))
export const deficitOn = (phases: Phase[], date: string) => { const phase = phaseOn(phases, date); return phase ? phase.maintenanceKcal - phase.intakeKcal : 0 }

// Calendar-window mean, so a missed weigh-in shortens the window instead of stretching it back in time.
export function movingAverage(entries: WeightEntry[], days = 7): number[] {
  return entries.map(entry => {
    const end = dayNumber(entry.date)
    const window = entries.filter(other => { const day = dayNumber(other.date); return day <= end && day > end - days })
    return window.reduce((sum, other) => sum + other.weightKg, 0) / window.length
  })
}

export interface Analysis {
  trendKg: number
  changeKg: number
  kgPerWeek: number | null
}

// boffin: kept weight trends independent of goals, phases and food estimates.
export function analyse(entries: WeightEntry[], windowDays = 21): Analysis | null {
  if (!entries.length) return null
  const latest = last(entries)!
  const trendKg = last(movingAverage(entries))!
  const window = entries.filter(entry => dayNumber(entry.date) > dayNumber(latest.date) - windowDays)
  const span = dayNumber(latest.date) - dayNumber(window[0].date)
  let kgPerDay: number | null = null
  if (span >= 7) {
    const xs = window.map(entry => dayNumber(entry.date)), mx = xs.reduce((a, b) => a + b) / xs.length
    const my = window.reduce((sum, entry) => sum + entry.weightKg, 0) / window.length
    kgPerDay = xs.reduce((sum, x, i) => sum + (x - mx) * (window[i].weightKg - my), 0) / xs.reduce((sum, x) => sum + (x - mx) ** 2, 0)
  }
  return {
    trendKg,
    changeKg: trendKg - entries[0].weightKg,
    kgPerWeek: kgPerDay === null ? null : kgPerDay * 7,
  }
}

// Food days roll over at 02:00 (matches the worker), so a late snack counts towards the evening before.
export const mealDay = (now = new Date()) => { const shifted = new Date(now.getTime() - 2 * 3600e3); return dateOf(Math.floor((shifted.getTime() - shifted.getTimezoneOffset() * 60000) / DAY_MS)) }

// Consecutive logged days ending the day before `date`.
export function streakBefore(entries: WeightEntry[], date: string): number {
  const logged = new Set(entries.map(entry => entry.date))
  let streak = 0
  while (logged.has(dateOf(dayNumber(date) - streak - 1))) streak++
  return streak
}

// Accepts rows copied from the sheet: "14/10/2026<TAB>80,55" (or ISO dates); rows without a weight are skipped.
export function parseSheetRows(text: string): WeightEntry[] {
  const entries = new Map<string, number>()
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:(\d{1,2})\/(\d{1,2})\/(\d{4})|(\d{4}-\d{2}-\d{2}))(?:\t| +)(\d+(?:[.,]\d+)?)/)
    if (!match) continue
    const date = match[4] ?? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
    const weightKg = Number(match[5].replace(',', '.'))
    if (!Number.isNaN(dayNumber(date)) && weightKg >= 20 && weightKg <= 400) entries.set(date, weightKg)
  }
  return [...entries].sort(([a], [b]) => a.localeCompare(b)).map(([date, weightKg]) => ({ date, weightKg }))
}
