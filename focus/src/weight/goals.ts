import { dateOf, dayNumber, DEFAULT_PROTEIN_PER_KG, deficitOn, KCAL_PER_KG, last, localToday, movingAverage, phaseOn, type FoodDay, type Phase, type WeightEntry, type WeightGoal, type WeightProfile } from './model.ts'

export function profileExpenditure(profile: WeightProfile, weightKg: number): { restingKcal: number; totalKcal: number } {
  const restingKcal = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.sex === 'male' ? 5 : -161)
  return { restingKcal, totalKcal: restingKcal * profile.activityFactor }
}

export function observedExpenditure(entries: WeightEntry[], days: FoodDay[], today: string): { kcal: number; startDate: string; endDate: string; foodDays: number; weighIns: number } | null {
  const weights = new Map(entries.map(entry => [entry.date, entry]))
  const complete = new Map(days.filter(day => day.confirmedRevision !== null && day.confirmedRevision === day.revision && day.kcal !== null && Number.isFinite(day.kcal) && day.kcal >= 0).map(day => [day.date, day.kcal!]))
  for (let offset = 0; offset < 7; offset++) {
    const end = dayNumber(today) - offset, start = end - 28
    const startDate = dateOf(start), endDate = dateOf(end)
    if (!weights.has(startDate) || !weights.has(endDate)) continue
    const intakes = Array.from({ length: 28 }, (_, i) => complete.get(dateOf(start + i)))
    if (intakes.some(kcal => kcal === undefined)) continue
    const readings = [...weights.values()].filter(entry => entry.date >= startDate && entry.date <= endDate)
    if (readings.length < 14) continue
    // boffin: kept the last boundary weigh-in while excluding that day's food.
    const xs = readings.map(entry => dayNumber(entry.date) - start)
    const mx = xs.reduce((sum, x) => sum + x, 0) / xs.length
    const my = readings.reduce((sum, entry) => sum + entry.weightKg, 0) / readings.length
    const slope = xs.reduce((sum, x, i) => sum + (x - mx) * (readings[i].weightKg - my), 0) / xs.reduce((sum, x) => sum + (x - mx) ** 2, 0)
    const intake = intakes.reduce<number>((sum, kcal) => sum + kcal!, 0) / 28
    const kcal = Math.round((intake - slope * KCAL_PER_KG) / 50) * 50
    if (Number.isFinite(kcal)) return { kcal, startDate, endDate, foodDays: 28, weighIns: readings.length }
  }
  return null
}

export function goalOn(goals: WeightGoal[], date: string): WeightGoal | undefined {
  return goals.reduce<WeightGoal | undefined>((active, goal) => goal.startDate <= date && (!active || goal.startDate >= active.startDate) ? goal : active, undefined)
}

export function goalReference(goals: WeightGoal[], until: string): WeightEntry[] {
  const versions = [...goals].sort((a, b) => a.startDate.localeCompare(b.startDate))
  return versions.flatMap((goal, index) => {
    const start = dayNumber(goal.startDate), deadline = dayNumber(goal.targetDate)
    const end = Math.min(deadline, dayNumber(until), versions[index + 1] ? dayNumber(versions[index + 1].startDate) - 1 : deadline)
    const points: WeightEntry[] = []
    for (let day = start; day <= end && deadline > start; day++) {
      const progress = (day - start) / (deadline - start)
      points.push({ date: dateOf(day), weightKg: goal.startWeightKg + (goal.targetWeightKg - goal.startWeightKg) * progress })
    }
    return points
  })
}

export function goalProgress(entries: WeightEntry[], goal: WeightGoal, date: string): { trendKg: number; readings: number; reached: boolean } | null {
  if (date < goal.startDate) return null
  const start = dateOf(dayNumber(date) - 6)
  const readings = [...new Map(entries.filter(entry => entry.date >= start && entry.date <= date).map(entry => [entry.date, entry])).values()]
  if (!readings.length) return null
  const trendKg = readings.reduce((sum, entry) => sum + entry.weightKg, 0) / readings.length
  return { trendKg, readings: readings.length, reached: readings.length >= 4 && readings.some(entry => entry.date === date) && trendKg <= goal.targetWeightKg }
}

// Future raw readings only; callers prepend recent actual readings before applying the calendar mean.
export function forecast(entries: WeightEntry[], phases: Phase[], until: string, from?: string): WeightEntry[] {
  const latest = entries.reduce<WeightEntry | undefined>((current, entry) => !current || entry.date > current.date ? entry : current, undefined)
  if (!latest) return []
  const accepted = [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const points: WeightEntry[] = []
  let weightKg = latest.weightKg
  for (let day = dayNumber(latest.date) + 1; day <= dayNumber(until); day++) {
    weightKg -= deficitOn(accepted, dateOf(day - 1)) / KCAL_PER_KG
    const date = dateOf(day)
    if (!from || date >= from) points.push({ date, weightKg })
  }
  return points
}

export function suggestPhase(entries: WeightEntry[], phases: Phase[], goal: WeightGoal, profile: WeightProfile, maintenanceKcal: number, startDate = localToday()): { ok: true; phase: Phase; projectedAverageKg: number } | { ok: false; error: string } {
  const dates = [startDate, goal.startDate, goal.targetDate]
  if (dates.some(date => !Number.isFinite(dayNumber(date)) || dateOf(dayNumber(date)) !== date)) return { ok: false, error: 'Choose valid calendar dates.' }
  if (goal.targetDate <= localToday() || startDate >= goal.targetDate) return { ok: false, error: 'Choose a future deadline after the phase starts.' }
  if (startDate < localToday()) return { ok: false, error: 'A proposed phase must start today or later.' }
  if (![profile.age, profile.heightCm, profile.activityFactor, goal.startWeightKg, goal.targetWeightKg].every(Number.isFinite) || profile.heightCm <= 0 || profile.activityFactor <= 0) return { ok: false, error: 'Complete the profile and goal with finite values.' }
  if (profile.age < 20) return { ok: false, error: 'Automatic proposals require age 20 or older.' }
  if (goal.targetWeightKg / (profile.heightCm / 100) ** 2 < 18.5) return { ok: false, error: 'The target BMI must be at least 18.5.' }
  if (goal.targetWeightKg >= goal.startWeightKg) return { ok: false, error: 'Choose a target below the saved starting average.' }
  if (!Number.isFinite(maintenanceKcal) || maintenanceKcal < 500 || maintenanceKcal > 10000) return { ok: false, error: 'Choose a valid daily expenditure between 500 and 10,000 kcal.' }
  const actual = [...new Map(entries.filter(entry => entry.date <= startDate).map(entry => [entry.date, entry])).values()]
  if (!actual.length || actual.some(entry => !Number.isFinite(entry.weightKg))) return { ok: false, error: 'Add a weigh-in before calculating a phase.' }
  const accepted = [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const phase: Phase = { startDate, maintenanceKcal: Math.round(maintenanceKcal), intakeKcal: 1000, proteinPerKg: phaseOn(accepted, startDate)?.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG }
  const project = (intakeKcal: number) => {
    const planned = [...accepted.filter(existing => existing.startDate !== startDate), { ...phase, intakeKcal }]
    const windowStart = dateOf(dayNumber(goal.targetDate) - 6)
    const readings = [...actual, ...forecast(actual, planned, goal.targetDate)].filter(entry => entry.date >= windowStart && entry.date <= goal.targetDate)
    return last(movingAverage(readings))!
  }
  // boffin: kept later accepted phases in the projection when solving the deadline average.
  const low = project(1000), high = project(10000)
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low || low > goal.targetWeightKg + 1e-9 || high < goal.targetWeightKg - 1e-9) return { ok: false, error: 'No permitted intake meets this deadline with the scheduled phases. Choose a later deadline or revised goal.' }
  phase.intakeKcal = Math.floor(1000 + (goal.targetWeightKg - low) * 9000 / (high - low) + 1e-7)
  if (phase.intakeKcal < 1000 || phase.intakeKcal > 10000) return { ok: false, error: 'The suggested intake must be between 1,000 and 10,000 kcal. Choose a later deadline or revised goal.' }
  return { ok: true, phase, projectedAverageKg: project(phase.intakeKcal) }
}
