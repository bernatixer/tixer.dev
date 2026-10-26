import { useState, type FormEvent } from 'react'
import type { WeightProfile, Workout } from './model'
import { profileExpenditure, WORKOUT_EFFORTS, workoutExpenditure } from './goals'
import { WeightDialog } from './WeightDialog'
import { formatRunningPace, parseWorkoutSpeed } from './format'

type WorkoutDraft = { sport: Workout['sport']; effort: NonNullable<Workout['effort']>; minutesPerSession: string; sessionsPerWeek: string; speedKmh: number | null; pace: string }
const speedText = (sport: Workout['sport'], speedKmh: number | null) => speedKmh == null ? '' : sport === 'running' ? formatRunningPace(speedKmh) : String(Number(speedKmh.toFixed(2)))

export function ProfileEditor({ profile, weightKg, onSave, onClose }: {
  profile: WeightProfile | null; weightKg: number; onSave: (profile: WeightProfile) => Promise<unknown>; onClose: () => void
}) {
  const [age, setAge] = useState(profile ? String(profile.age) : ''), [height, setHeight] = useState(profile ? String(profile.heightCm) : '')
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex ?? 'male'), [steps, setSteps] = useState(profile?.stepsPerDay == null ? '' : String(profile.stepsPerDay))
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>(() => {
    const saved: Workout[] = profile?.workouts ?? (profile?.sport && profile.sport !== 'none' ? [{ sport: profile.sport, minutesPerSession: profile.sportMinutes ?? 45, sessionsPerWeek: profile.sportDaysPerWeek ?? 3 }] : [])
    return saved.map(workout => ({ sport: workout.sport, effort: workout.effort ?? 'normal', minutesPerSession: String(workout.minutesPerSession), sessionsPerWeek: String(workout.sessionsPerWeek), speedKmh: workout.speedKmh ?? null, pace: speedText(workout.sport, workout.speedKmh ?? null) }))
  })
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const draft: WeightProfile = { age: Number(age), heightCm: Number(height), sex, activityFactor: 1.2, stepsPerDay: Number(steps), stepsIncludeRuns: false, workouts: workouts.map(workout => ({ sport: workout.sport, effort: workout.effort, minutesPerSession: Number(workout.minutesPerSession), sessionsPerWeek: Number(workout.sessionsPerWeek), speedKmh: workout.sport === 'running' || workout.sport === 'jogging' ? workout.speedKmh : null })) }
  const invalidSpeed = workouts.some(workout => (workout.sport === 'running' || workout.sport === 'jogging') && workout.pace !== '' && workout.speedKmh === null)
  const complete = age !== '' && height !== '' && steps !== '' && !invalidSpeed && workouts.every(workout => workout.minutesPerSession !== '' && workout.sessionsPerWeek !== '')
  const estimate = complete ? profileExpenditure(draft, weightKg) : null
  const changeWorkout = (index: number, update: Partial<WorkoutDraft>) => setWorkouts(values => values.map((workout, position) => position === index ? { ...workout, ...update } : workout))
  const changeSport = (index: number, sport: Workout['sport']) => {
    // boffin: switching display units keeps the exact speed, rather than parsing a rounded pace back.
    changeWorkout(index, { sport, pace: speedText(sport, workouts[index].speedKmh) })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!estimate || !Number.isFinite(estimate.totalKcal)) { setError(invalidSpeed ? 'Use a running pace from 2:37 to 15:00 min/km, or a jogging speed from 4 to 23 km/h.' : 'Complete your measurements and workout details.'); return }
    setBusy(true); setError('')
    try { await onSave(draft); onClose() } catch { setError('Could not save your estimate. Your measurements are still here; try again.') } finally { setBusy(false) }
  }
  return <WeightDialog title="Metabolism and daily activity" closeLabel="Close estimate" dirty={dirty} busy={busy} onClose={onClose}>
    <p className="finance-muted">Your measurements estimate resting metabolism. Walking steps and workouts add movement, averaged across your week.</p>
    <form onSubmit={submit} onChange={() => setDirty(true)}><fieldset disabled={busy} className="weight-form weight-profile">
      <div className="weight-profile__basics">
        <label className="finance-field">Age<input type="number" required min="20" max="120" step="1" value={age} onChange={event => setAge(event.target.value)} /></label>
        <label className="finance-field">Height (cm)<input type="number" required min="100" max="250" step="0.1" value={height} onChange={event => setHeight(event.target.value)} /></label>
        <div className="finance-field"><span>Equation sex</span><div className="weight-profile__sex" role="group" aria-label="Equation sex">{(['male', 'female'] as const).map(value => <button key={value} type="button" aria-pressed={sex === value} onClick={() => { setSex(value); setDirty(true) }}>{value === 'male' ? 'Male' : 'Female'}</button>)}</div></div>
        <label className="finance-field">Walking steps per day<input type="number" required min="0" max="100000" step="1" value={steps} onChange={event => setSteps(event.target.value)} placeholder="Your usual daily average" /></label>
      </div>

      <div className="finance-card-heading"><span className="finance-eyebrow">WEEKLY WORKOUTS</span><button type="button" disabled={workouts.length >= 8} onClick={() => { setWorkouts(values => [...values, { sport: 'strength', effort: 'normal', minutesPerSession: '45', sessionsPerWeek: '3', speedKmh: null, pace: '' }]); setDirty(true) }}>Add workout</button></div>
      {workouts.length >= 8 && <p className="finance-muted">Up to 8 weekly workouts. Remove one to add another.</p>}
      {workouts.length === 0 && <p className="finance-muted">No regular workouts added. Your steps still count.</p>}
      {workouts.map((workout, index) => {
        const sport = workout.sport, paced = sport === 'running' || sport === 'jogging'
        const energy = workout.minutesPerSession !== '' && workout.sessionsPerWeek !== '' && (!paced || workout.pace === '' || workout.speedKmh !== null) ? workoutExpenditure(draft.workouts![index], weightKg) : null
        return <fieldset className="weight-profile__workout" key={index}><legend>Workout {index + 1}</legend>
        <div className="weight-profile__workout-kind">
          <label className="finance-field">Activity<select aria-label={`Workout ${index + 1} sport`} value={workout.sport} onChange={event => changeSport(index, event.target.value as Workout['sport'])}><option value="strength">Strength training</option><option value="cycling">Cycling</option><option value="jogging">Jogging</option><option value="running">Running</option><option value="swimming">Swimming</option></select></label>
          {sport === 'running' ? <label className="finance-field">Pace (min/km)<input aria-label={`Workout ${index + 1} pace (min/km)`} type="text" pattern="[0-9]{1,2}(:[0-5][0-9])?" maxLength={5} value={workout.pace} placeholder="e.g. 6:00" title="Minutes:seconds per kilometre. Add your usual pace to refine calories." onChange={event => changeWorkout(index, { pace: event.target.value, speedKmh: parseWorkoutSpeed('running', event.target.value) })} /></label>
          : sport === 'jogging' ? <label className="finance-field">Speed (km/h)<input aria-label={`Workout ${index + 1} speed (km/h)`} type="number" min="4" max="23" step="any" value={workout.pace} placeholder="e.g. 8" title="Add your usual speed to refine calories." onChange={event => changeWorkout(index, { pace: event.target.value, speedKmh: parseWorkoutSpeed('jogging', event.target.value) })} /></label>
          : <label className="finance-field">Effort<select aria-label={`Workout ${index + 1} effort`} value={workout.effort} onChange={event => changeWorkout(index, { effort: event.target.value as WorkoutDraft['effort'] })}>{(['easy', 'normal', 'hard'] as const).map(effort => <option key={effort} value={effort}>{WORKOUT_EFFORTS[sport][effort].label}</option>)}</select></label>}
        </div>
        <label className="finance-field">Min / session<input aria-label={`Workout ${index + 1} minutes per session`} type="number" required min="1" max="600" step="1" value={workout.minutesPerSession} onChange={event => changeWorkout(index, { minutesPerSession: event.target.value })} /></label>
        <label className="finance-field">Sessions / week<input aria-label={`Workout ${index + 1} sessions per week`} type="number" required min="0" max="14" step="0.5" value={workout.sessionsPerWeek} onChange={event => changeWorkout(index, { sessionsPerWeek: event.target.value })} /></label>
        <button type="button" className="finance-remove" aria-label={`Remove workout ${index + 1}`} onClick={() => { setWorkouts(values => values.filter((_, position) => position !== index)); setDirty(true) }}><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="m6.4 4.9 5.6 5.7 5.6-5.7 1.5 1.5-5.7 5.6 5.7 5.6-1.5 1.5-5.6-5.7-5.6 5.7-1.5-1.5 5.7-5.6-5.7-5.6z" /></svg></button>
        {energy && <p className="weight-profile__workout-energy">~{Math.round(energy.sessionActiveKcal)} active / {Math.round(energy.sessionTotalKcal)} total kcal/session · +{Math.round(energy.dailyActiveKcal)} kcal/day avg.</p>}
      </fieldset>})}
      {estimate && Number.isFinite(estimate.totalKcal) && <div className="weight-proposal"><strong>{Math.round(estimate.totalKcal)} kcal / day</strong><dl className="weight-activity__breakdown"><div><dt>Resting</dt><dd>{Math.round(estimate.restingKcal)}</dd></div><div><dt>Daily extras</dt><dd>{Math.round(estimate.backgroundKcal)}</dd></div><div><dt>Walking</dt><dd>{Math.round(estimate.stepsKcal)}</dd></div><div><dt>Workouts/day</dt><dd>{Math.round(estimate.sportKcal)}</dd></div></dl><small>Daily extras: a rough 20% of resting calories for digestion and untracked everyday movement. Only active workout calories are added; rest is already included.</small><small>Using {weightKg.toFixed(1)} kg. Food and weight logs refine this starting estimate.</small></div>}
      {error && <p role="alert" className="finance-danger">{error}</p>}
      <button className="finance-primary">{busy ? 'Saving…' : 'Save estimate'}</button>
    </fieldset></form>
  </WeightDialog>
}
