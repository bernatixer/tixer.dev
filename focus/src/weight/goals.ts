import { analyse, dateOf, dayNumber, KCAL_PER_KG, last, type Phase, type FoodDay, type WeightEntry, type WeightGoal, type WeightProfile, type Workout } from './model.ts'

// Activity METs from the 2024 Adult Compendium: https://pacompendium.com/
export const WORKOUT_EFFORTS = {
  strength: { easy: { label: 'Body-weight exercises', met: 3 }, normal: { label: 'General weights', met: 3.5 }, hard: { label: 'Vigorous weights', met: 6 } },
  running: { easy: { label: 'Jog ~6.5 km/h', met: 6.5 }, normal: { label: 'General jog', met: 7.5 }, hard: { label: 'Run ~10 km/h', met: 9.3 } },
  cycling: { easy: { label: 'Relaxed <16 km/h', met: 4 }, normal: { label: 'Steady 16–19 km/h', met: 6.8 }, hard: { label: 'Fast 23–26 km/h', met: 10 } },
  swimming: { easy: { label: 'Recreational backstroke', met: 4.8 }, normal: { label: 'Easy freestyle', met: 5.8 }, hard: { label: 'Fast freestyle', met: 9.8 } },
} as const

// Level-ground speed ranges in mph and their published MET values.
const RUNNING_MET_SPEEDS = [
  [2.6, 3.7, 3.3], [4, 4.2, 6.5], [4.3, 4.8, 7.8], [5, 5.2, 8.5], [5.5, 5.8, 9],
  [6, 6.3, 9.3], [6.7, 6.7, 10.5], [7, 7, 11], [7.5, 7.5, 11.8], [8, 8, 12],
  [8.6, 8.6, 12.5], [9, 9, 13], [9.3, 9.6, 14.8], [10, 10, 14.8],
  [11, 11, 16.8], [12, 12, 18.5], [13, 13, 19.8], [14, 14, 23],
] as const

export function workoutExpenditure(workout: Workout, weightKg: number): { sessionActiveKcal: number; sessionTotalKcal: number; dailyActiveKcal: number } {
  let met: number = WORKOUT_EFFORTS[workout.sport === 'jogging' ? 'running' : workout.sport][workout.effort ?? 'normal'].met
  if ((workout.sport === 'running' || workout.sport === 'jogging') && workout.speedKmh != null) {
    const mph = workout.speedKmh / 1.609344
    let nearest = Infinity
    for (const [min, max, value] of RUNNING_MET_SPEEDS) {
      const distance = Math.max(min - mph, mph - max, 0)
      if (distance < nearest) { met = value; nearest = distance }
    }
  }
  const restingSessionKcal = 3.5 * weightKg / 200 * workout.minutesPerSession
  // boffin: add only energy above rest to the daily total; keep session totals separate.
  const sessionActiveKcal = (met - 1) * restingSessionKcal
  return { sessionActiveKcal, sessionTotalKcal: met * restingSessionKcal, dailyActiveKcal: sessionActiveKcal * workout.sessionsPerWeek / 7 }
}

export function profileExpenditure(profile: WeightProfile, weightKg: number): { restingKcal: number; totalKcal: number; backgroundKcal: number; stepsKcal: number; sportKcal: number; legacyActivity: boolean } {
  const restingKcal = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.sex === 'male' ? 5 : -161)
  // boffin: kept saved activity factors until steps or sport are supplied.
  const legacyActivity = [profile.stepsPerDay, profile.sport, profile.sportMinutes, profile.sportDaysPerWeek, profile.workouts].every(value => value == null)
  if (legacyActivity) {
    const totalKcal = restingKcal * profile.activityFactor
    return { restingKcal, totalKcal, backgroundKcal: totalKcal - restingKcal, stepsKcal: 0, sportKcal: 0, legacyActivity }
  }
  // shortcut: cadence and MET averages approximate activity; use measured expenditure when available.
  const sport = profile.sport ?? 'none'
  const workouts = profile.workouts ?? (sport === 'none' ? [] : [{ sport, minutesPerSession: profile.sportMinutes ?? 0, sessionsPerWeek: profile.sportDaysPerWeek ?? 0 }])
  const sportKcal = workouts.reduce((sum, workout) => sum + workoutExpenditure(workout, weightKg).dailyActiveKcal, 0)
  const walkingSteps = profile.stepsPerDay ?? 0
  const backgroundKcal = restingKcal * 0.2
  const stepsKcal = (3 - 1) * 3.5 * weightKg / 200 * (walkingSteps / 100)
  return { restingKcal, totalKcal: restingKcal + backgroundKcal + stepsKcal + sportKcal, backgroundKcal, stepsKcal, sportKcal, legacyActivity }
}

export function observedExpenditure(entries: WeightEntry[], days: FoodDay[], today: string): { kcal: number; averageIntakeKcal: number; kgPerWeek: number; startDate: string; endDate: string; foodDays: number; weighIns: number; provisional: boolean } | null {
  const weights = new Map(entries.map(entry => [entry.date, entry]))
  const logged = new Map(days.filter(day => day.mealCount > 0 && day.kcal !== null && Number.isFinite(day.kcal) && day.kcal >= 0).map(day => [day.date, day.kcal!]))
  const endpoints = [...weights.keys()].filter(date => date <= today).sort((a, b) => b.localeCompare(a))
  for (const endDate of endpoints) {
    const end = dayNumber(endDate)
    for (let foodDays = 28; foodDays >= 1; foodDays--) {
      const start = end - foodDays, startDate = dateOf(start)
      if (!weights.has(startDate)) continue
      const intakes = Array.from({ length: foodDays }, (_, i) => logged.get(dateOf(start + i)))
      if (intakes.some(kcal => kcal === undefined)) continue
      const readings = [...weights.values()].filter(entry => entry.date >= startDate && entry.date <= endDate)
      if (readings.length < 2) continue
      // boffin: kept the last boundary weigh-in while excluding that day's food.
      const xs = readings.map(entry => dayNumber(entry.date) - start)
      const mx = xs.reduce((sum, x) => sum + x, 0) / xs.length
      const my = readings.reduce((sum, entry) => sum + entry.weightKg, 0) / readings.length
      const slope = xs.reduce((sum, x, i) => sum + (x - mx) * (readings[i].weightKg - my), 0) / xs.reduce((sum, x) => sum + (x - mx) ** 2, 0)
      const averageIntakeKcal = intakes.reduce<number>((sum, kcal) => sum + kcal!, 0) / foodDays
      const kcal = Math.round((averageIntakeKcal - slope * KCAL_PER_KG) / 50) * 50
      if (Number.isFinite(kcal)) return { kcal, averageIntakeKcal, kgPerWeek: slope * 7, startDate, endDate, foodDays, weighIns: readings.length, provisional: foodDays < 21 || readings.length < Math.max(4, Math.ceil(foodDays / 2)) }
    }
  }
  return null
}

export function goalOn(goals: WeightGoal[], date: string): WeightGoal | undefined {
  return goals.reduce<WeightGoal | undefined>((active, goal) => goal.startDate <= date && (!active || goal.startDate >= active.startDate) ? goal : active, undefined)
}

export function intakeTargetOn(goals: WeightGoal[], phases: Phase[], date: string): number | null {
  const goal = goalOn(goals, date)
  // boffin: an active goal without a budget must not revive an older calorie target.
  if (goal) return goal.intakeKcal ?? null
  return phases.reduce<Phase | undefined>((active, phase) => phase.startDate <= date && (!active || phase.startDate > active.startDate) ? phase : active, undefined)?.intakeKcal ?? null
}

export function goalReference(goals: WeightGoal[], until: string): WeightEntry[] {
  const versions = [...goals].sort((a, b) => a.startDate.localeCompare(b.startDate))
  return versions.flatMap((goal, index) => {
    const start = dayNumber(goal.startDate), deadline = dayNumber(goal.targetDate)
    if (deadline <= start) return []
    const end = Math.min(deadline, dayNumber(until), versions[index + 1] ? dayNumber(versions[index + 1].startDate) - 1 : deadline)
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, offset) => ({ date: dateOf(start + offset), weightKg: goal.startWeightKg + (goal.targetWeightKg - goal.startWeightKg) * offset / (deadline - start) }))
  })
}

function forecastTrend(entries: WeightEntry[], asOf: string): { date: string; weightKg: number; kgPerWeek: number } | null {
  const actual = [...new Map(entries.filter(entry => entry.date <= asOf).map(entry => [entry.date, entry])).values()].sort((a, b) => a.date.localeCompare(b.date))
  const latest = last(actual)
  if (!latest) return null
  const recent = actual.filter(entry => dayNumber(entry.date) > dayNumber(latest.date) - 21)
  if (recent.length < 4) return null
  const result = analyse(recent)
  return result && result.kgPerWeek !== null ? { date: latest.date, weightKg: result.trendKg, kgPerWeek: result.kgPerWeek } : null
}

// Conditional trend points are already averaged; no calorie target is used to produce this outlook.
export function observedTrendForecast(entries: WeightEntry[], until: string, asOf: string): WeightEntry[] {
  const trend = forecastTrend(entries, asOf)
  if (!trend) return []
  const start = dayNumber(trend.date), end = Math.min(dayNumber(until), start + 21)
  const points: WeightEntry[] = []
  for (let day = start; day <= end; day++) points.push({ date: dateOf(day), weightKg: trend.weightKg + trend.kgPerWeek / 7 * (day - start) })
  return points
}

type GoalArrival = { status: 'estimated'; date: string; kgPerWeek: number }
  | { status: 'insufficient-data' | 'needs-weigh-in' | 'at-goal' | 'not-progressing' | 'long-range' }

export function goalArrival(entries: WeightEntry[], goal: WeightGoal, today: string): GoalArrival {
  const trend = forecastTrend(entries, today)
  if (!trend) return { status: 'insufficient-data' }
  if (dayNumber(today) - dayNumber(trend.date) >= 7) return { status: 'needs-weigh-in' }
  if (trend.weightKg <= goal.targetWeightKg) return { status: 'at-goal' }
  if (trend.kgPerWeek >= 0) return { status: 'not-progressing' }
  // boffin: use the chart's same trend and avoid rounding noise shifting arrival by a full day.
  const days = Math.max(1, Math.ceil((goal.targetWeightKg - trend.weightKg) * 7 / trend.kgPerWeek - 1e-9))
  const arrivalDay = dayNumber(trend.date) + days
  if (arrivalDay <= dayNumber(today)) return { status: 'needs-weigh-in' }
  if (arrivalDay - dayNumber(today) > 365) return { status: 'long-range' }
  const date = dateOf(arrivalDay)
  return { status: 'estimated', date, kgPerWeek: trend.kgPerWeek }
}

export function goalProgress(entries: WeightEntry[], goal: WeightGoal, date: string): { trendKg: number; readings: number; reached: boolean } | null {
  if (date < goal.startDate) return null
  const start = dateOf(dayNumber(date) - 6)
  const readings = [...new Map(entries.filter(entry => entry.date >= start && entry.date <= date).map(entry => [entry.date, entry])).values()]
  if (!readings.length) return null
  const trendKg = readings.reduce((sum, entry) => sum + entry.weightKg, 0) / readings.length
  return { trendKg, readings: readings.length, reached: readings.length >= 4 && readings.some(entry => entry.date === date) && trendKg <= goal.targetWeightKg }
}
