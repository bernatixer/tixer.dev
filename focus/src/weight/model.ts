export interface WeightEntry { date: string; weightKg: number }
export interface Phase { startDate: string; maintenanceKcal: number; intakeKcal: number; proteinPerKg?: number | null }
export interface Workout { sport: 'strength' | 'cycling' | 'running' | 'jogging' | 'swimming'; minutesPerSession: number; sessionsPerWeek: number; effort?: 'easy' | 'normal' | 'hard' | null; speedKmh?: number | null }
export interface WeightProfile {
  age: number; heightCm: number; sex: 'male' | 'female'; activityFactor: number
  stepsPerDay?: number | null
  sport?: 'none' | Workout['sport'] | null
  sportMinutes?: number | null
  sportDaysPerWeek?: number | null
  workouts?: Workout[] | null
  stepsIncludeRuns?: boolean | null
}
export interface WeightGoal { startDate: string; startWeightKg: number; targetDate: string; targetWeightKg: number; intakeKcal?: number | null }
export interface FoodDay { date: string; kcal: number | null; mealCount: number }
// Nutrient grams are null on meals logged before they were estimated.
export interface Meal { id: string; date: string; description: string; kcal: number; proteinG?: number | null; carbsG?: number | null; fatG?: number | null; saturatedG?: number | null; fibreG?: number | null; sugarG?: number | null; createdAt: string }

// Current target; stored phase settings remain available as historical data.
export const DEFAULT_PROTEIN_PER_KG = 1.5
export const MIN_FAT_PER_KG = 0.6

// Reserve the calorie budget for the fixed protein target and a conservative fat floor; carbs receive what remains.
export function carbTarget(kcalTarget?: number | null, bodyKg?: number): number | null {
  if (typeof kcalTarget !== 'number' || !Number.isFinite(kcalTarget) || kcalTarget <= 0 || typeof bodyKg !== 'number' || !Number.isFinite(bodyKg) || bodyKg <= 0) return null
  const remaining = kcalTarget - bodyKg * (DEFAULT_PROTEIN_PER_KG * 4 + MIN_FAT_PER_KG * 9)
  return remaining > 0 ? Math.round(remaining / 4) : null
}

// Energy in a kg of mixed body-weight loss; the /9 kcal-per-gram figure assumes pure fat and overstates the pace.
export const KCAL_PER_KG = 7700
const DAY_MS = 864e5

export const last = <T,>(items: T[]): T | undefined => items[items.length - 1]

export const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS
export const dateOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10)
export const localToday = () => { const now = new Date(); return dateOf(Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / DAY_MS)) }

// Calendar-window mean, so a missed weigh-in shortens the window instead of stretching it back in time.
export function movingAverage(entries: WeightEntry[], days = 7): number[] {
  return entries.map(entry => averageAt(entries, entry.date, days)!)
}

function averageAt(entries: WeightEntry[], date: string, days: number): number | null {
  const end = dayNumber(date)
  const window = entries.filter(entry => { const day = dayNumber(entry.date); return day <= end && day > end - days })
  return window.length ? window.reduce((sum, entry) => sum + entry.weightKg, 0) / window.length : null
}

export function trendAt(entries: WeightEntry[], date: string): number | null {
  return averageAt(entries, date, 7)
}

export function bodyMassIndex(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(heightCm) || heightCm <= 0) return null
  const value = weightKg / (heightCm / 100) ** 2
  return Number.isFinite(value) ? value : null
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
