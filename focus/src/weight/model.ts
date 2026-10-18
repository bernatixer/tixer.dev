export interface WeightEntry { date: string; weightKg: number }
export interface Phase { startDate: string; maintenanceKcal: number; intakeKcal: number }
export interface Meal { id: string; date: string; description: string; kcal: number; createdAt: string }

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

// Starts at the first weigh-in; each day's planned deficit shows up on the next day's goal.
export function goalLine(entries: WeightEntry[], phases: Phase[], until: string): WeightEntry[] {
  if (!entries.length) return []
  const points: WeightEntry[] = []
  let weightKg = entries[0].weightKg
  for (let day = dayNumber(entries[0].date); day <= dayNumber(until); day++) {
    const date = dateOf(day)
    points.push({ date, weightKg })
    weightKg -= deficitOn(phases, date) / KCAL_PER_KG
  }
  return points
}

export interface Analysis {
  trendKg: number
  changeKg: number
  vsGoalKg: number | null
  kgPerWeek: number | null
  plannedKgPerWeek: number | null
  maintenanceKcal: number | null
  loggedDays: number
}

// `eaten` holds totals for closed days only; other days fall back to the planned intake.
export function analyse(entries: WeightEntry[], phases: Phase[], windowDays = 21, eaten = new Map<string, number>()): Analysis | null {
  if (!entries.length) return null
  const latest = last(entries)!
  const trendKg = last(movingAverage(entries))!
  const goal = last(goalLine(entries, phases, latest.date))!
  const current = phaseOn(phases, latest.date)
  const window = entries.filter(entry => dayNumber(entry.date) > dayNumber(latest.date) - windowDays)
  const span = dayNumber(latest.date) - dayNumber(window[0].date)
  let kgPerDay: number | null = null
  if (span >= 7) {
    const xs = window.map(entry => dayNumber(entry.date)), mx = xs.reduce((a, b) => a + b) / xs.length
    const my = window.reduce((sum, entry) => sum + entry.weightKg, 0) / window.length
    kgPerDay = xs.reduce((sum, x, i) => sum + (x - mx) * (window[i].weightKg - my), 0) / xs.reduce((sum, x) => sum + (x - mx) ** 2, 0)
  }
  // Real maintenance = what you ate + the energy the scale says you burned off; needs two weeks to beat water noise.
  let maintenanceKcal: number | null = null, loggedDays = 0
  if (kgPerDay !== null && span >= 14) {
    const intakes: number[] = []
    for (let day = dayNumber(window[0].date); day < dayNumber(latest.date); day++) {
      const date = dateOf(day), logged = eaten.get(date)
      if (logged !== undefined) loggedDays++
      intakes.push(logged ?? phaseOn(phases, date)?.intakeKcal ?? NaN)
    }
    const intake = intakes.reduce((a, b) => a + b, 0) / intakes.length
    if (!Number.isNaN(intake)) maintenanceKcal = Math.round(intake - kgPerDay * KCAL_PER_KG)
  }
  return {
    trendKg,
    changeKg: trendKg - entries[0].weightKg,
    vsGoalKg: phases.length ? trendKg - goal.weightKg : null,
    kgPerWeek: kgPerDay === null ? null : kgPerDay * 7,
    plannedKgPerWeek: current ? -(current.maintenanceKcal - current.intakeKcal) * 7 / KCAL_PER_KG : null,
    maintenanceKcal,
    loggedDays,
  }
}

export function closedDayTotals(meals: Meal[], closedDays: string[]): Map<string, number> {
  const closed = new Set(closedDays), totals = new Map<string, number>()
  for (const meal of meals) if (closed.has(meal.date)) totals.set(meal.date, (totals.get(meal.date) ?? 0) + meal.kcal)
  return totals
}

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
