import { useState, type FormEvent } from 'react'
import { ApiError } from '@/api/client'
import { dateOf, dayNumber, last, localToday, mealDay, movingAverage, phaseOn, type FoodDay, type Phase, type WeightEntry, type WeightGoal, type WeightProfile } from './model'
import { goalOn, goalProgress, observedExpenditure, profileExpenditure, suggestPhase } from './goals'
import { WeightDialog } from './WeightDialog'

type Props = {
  entries: WeightEntry[]; phases: Phase[]; goals: WeightGoal[]; profile: WeightProfile | null; days: FoodDay[]
  onGoal: (date: string, goal: { targetWeightKg: number; targetDate: string }) => Promise<unknown>
  onProfile: (profile: WeightProfile) => Promise<unknown>
  onPhase: (phase: Phase) => Promise<unknown>
  onReview: (days: { date: string; revision: number }[]) => Promise<unknown>
}

export function WeightPlan(props: Props) {
  const [panel, setPanel] = useState<'goal' | 'profile' | 'recalculate' | null>(null)
  const today = localToday(), goal = goalOn(props.goals, today)
  const observed = observedExpenditure(props.entries, props.days, mealDay())
  const bodyKg = last(movingAverage(props.entries))
  const estimated = props.profile && bodyKg ? profileExpenditure(props.profile, bodyKg) : null
  const expired = !!goal && goal.targetDate < today
  const progress = goal ? goalProgress(props.entries, goal, expired ? goal.targetDate : today) : null
  const deadlineMeasured = !!goal && !!progress && progress.readings >= 4 && props.entries.some(entry => entry.date === goal.targetDate)
  const status = expired ? deadlineMeasured ? progress?.reached ? 'Target reached by deadline' : 'Above target at deadline' : 'Insufficient weigh-ins at deadline' : progress?.reached ? 'Target reached' : goal ? `${Math.max(0, dayNumber(goal.targetDate) - dayNumber(today))} days remaining` : ''
  return <article className="finance-card weight-goal">
    <div className="finance-card-heading"><span className="finance-eyebrow">WEIGHT GOAL</span><button type="button" onClick={() => setPanel('goal')} disabled={!props.entries.length}>{goal ? 'Change goal' : 'Set goal'}</button></div>
    <div className="weight-goal__body">
      <div>{goal ? <><strong className="weight-goal__target">{goal.targetWeightKg.toFixed(1)} <small>kg</small></strong><p>Seven-day average by <time>{goal.targetDate}</time></p><small className={progress?.reached ? 'weight-stat--good' : 'finance-muted'}>{status}</small>{expired && <p className="finance-muted">Set a new goal to calculate your next phase.</p>}</> : <><strong className="weight-goal__empty">A weight. A date. A plan.</strong><p className="finance-muted">{props.entries.length ? 'Choose where you want your seven-day average to be.' : 'Log your first weight to set a goal.'}</p></>}</div>
      <dl className="weight-goal__estimates">
        <div><dt>Profile estimate</dt><dd>{estimated ? `${Math.round(estimated.totalKcal)} kcal/day` : 'Not set'}</dd><small>{estimated ? `${Math.round(estimated.restingKcal)} resting × ${props.profile!.activityFactor} activity` : 'A starting point from your measurements'}</small></div>
        <div><dt>Observed daily burn</dt><dd>{observed ? `${observed.kcal} kcal/day` : 'Not enough reviewed data'}</dd><small>{observed ? `${observed.startDate} – ${observed.endDate} · ${observed.foodDays} food days · ${observed.weighIns} weigh-ins` : 'Needs 28 complete food days and aligned weigh-ins'}</small></div>
      </dl>
    </div>
    <div className="weight-plan__actions"><button type="button" onClick={() => setPanel('profile')} disabled={!props.entries.length}>{props.profile ? 'Edit burn estimate' : 'Estimate daily burn'}</button><button type="button" className="finance-primary" disabled={!goal} onClick={() => setPanel('recalculate')}>Recalculate</button></div>
    {panel === 'goal' && <GoalEditor entries={props.entries} goal={goal} onSave={props.onGoal} onClose={() => setPanel(null)} />}
    {panel === 'profile' && <ProfileEditor profile={props.profile} weightKg={bodyKg!} onSave={props.onProfile} onClose={() => setPanel(null)} />}
    {panel === 'recalculate' && <Recalculate {...props} onClose={() => setPanel(null)} />}
  </article>
}

function GoalEditor({ entries, goal, onSave, onClose }: { entries: WeightEntry[]; goal?: WeightGoal; onSave: Props['onGoal']; onClose: () => void }) {
  const [target, setTarget] = useState(String(goal?.targetWeightKg ?? Number((last(movingAverage(entries))! - 3).toFixed(1))))
  const [date, setDate] = useState(goal && goal.targetDate > localToday() ? goal.targetDate : dateOf(dayNumber(localToday()) + 60))
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await onSave(localToday(), { targetWeightKg: Number(target), targetDate: date }); onClose() }
    catch { setError('Could not save this goal. Choose a lower target weight and a future date.') }
    finally { setBusy(false) }
  }
  return <WeightDialog title="Set your weight goal" closeLabel="Close goal" dirty={dirty} busy={busy} onClose={onClose}>
    <p className="finance-muted">Your seven-day average is the measure of success. Changing the estimate later keeps this target fixed.</p>
    <form onSubmit={submit} onChange={() => setDirty(true)}><fieldset disabled={busy} className="weight-form">
      <label className="finance-field">Target weight (kg)<input type="number" inputMode="decimal" required min="20" max="400" step="0.05" value={target} onChange={event => setTarget(event.target.value)} /></label>
      <label className="finance-field">Target date<input type="date" required min={dateOf(dayNumber(localToday()) + 1)} value={date} onChange={event => setDate(event.target.value)} /></label>
      {error && <p role="alert" className="finance-danger">{error}</p>}
      <button className="finance-primary">{busy ? 'Saving…' : 'Save goal'}</button>
    </fieldset></form>
  </WeightDialog>
}

function ProfileEditor({ profile, weightKg, onSave, onClose }: { profile: WeightProfile | null; weightKg: number; onSave: Props['onProfile']; onClose: () => void }) {
  const [age, setAge] = useState(profile ? String(profile.age) : ''), [height, setHeight] = useState(profile ? String(profile.heightCm) : '')
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex ?? 'male'), [factor, setFactor] = useState(profile?.activityFactor ?? 1.4)
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const draft = { age: Number(age), heightCm: Number(height), sex, activityFactor: factor }
  const estimate = age && height ? profileExpenditure(draft, weightKg) : null
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await onSave(draft); onClose() } catch { setError('Could not save your estimate. Check the measurements and try again.') } finally { setBusy(false) }
  }
  return <WeightDialog title="Estimate daily burn" closeLabel="Close estimate" dirty={dirty} busy={busy} onClose={onClose}>
    <p className="finance-muted">Mifflin–St Jeor estimates resting energy from your measurements. Activity adds the rest. Food logs and weight trends can improve the total over time.</p>
    <form onSubmit={submit} onChange={() => setDirty(true)}><fieldset disabled={busy} className="weight-form">
      <p>Using your current trend: <strong>{weightKg.toFixed(2)} kg</strong></p>
      <div className="finance-fields"><label className="finance-field">Age<input type="number" required min="20" max="120" step="1" value={age} onChange={event => setAge(event.target.value)} /></label><label className="finance-field">Height (cm)<input type="number" required min="100" max="250" step="0.1" value={height} onChange={event => setHeight(event.target.value)} /></label></div>
      <label className="finance-field">Equation sex<select value={sex} onChange={event => setSex(event.target.value as 'male' | 'female')}><option value="male">Male</option><option value="female">Female</option></select></label>
      <label className="finance-field">Usual activity<select value={factor} onChange={event => setFactor(Number(event.target.value))}><option value="1.4">Mostly sitting · 1.4</option><option value="1.6">Light activity · 1.6</option><option value="1.8">Active most days · 1.8</option><option value="2">Very active · 2.0</option><option value="2.2">Physical work and training · 2.2</option></select></label>
      {estimate && <div className="weight-proposal"><strong>{Math.round(estimate.totalKcal)} kcal / day</strong><p>{Math.round(estimate.restingKcal)} resting × {factor} activity</p><small>A starting estimate of total expenditure, not a measurement.</small></div>}
      {error && <p role="alert" className="finance-danger">{error}</p>}<button className="finance-primary">{busy ? 'Saving…' : 'Save estimate'}</button>
    </fieldset></form>
  </WeightDialog>
}

function Recalculate({ entries, phases, profile, goals, days, onPhase, onReview, onClose }: Props & { onClose: () => void }) {
  const today = localToday(), foodToday = mealDay(), current = phaseOn(phases, today), goal = goalOn(goals, today)
  const observed = observedExpenditure(entries, days, foodToday)
  const weightKg = last(movingAverage(entries))
  const estimated = profile && weightKg ? profileExpenditure(profile, weightKg) : null
  const [source, setSource] = useState(observed ? 'observed' : estimated ? 'profile' : 'manual')
  const [start, setStart] = useState(today), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [reviewStart, setReviewStart] = useState(dateOf(Math.max(dayNumber(foodToday) - 28, dayNumber(days[0]?.date ?? foodToday) )))
  const [reviewEnd, setReviewEnd] = useState(dateOf(dayNumber(foodToday) - 1))
  const burn = source === 'observed' ? observed?.kcal : source === 'profile' ? estimated?.totalKcal : current?.maintenanceKcal
  const proposal = goal && profile && burn ? suggestPhase(entries, phases, goal, profile, burn, start) : null
  const range = dayNumber(reviewEnd) >= dayNumber(reviewStart) && dayNumber(reviewEnd) - dayNumber(reviewStart) < 366 ? Array.from({ length: dayNumber(reviewEnd) - dayNumber(reviewStart) + 1 }, (_, index) => {
    const date = dateOf(dayNumber(reviewStart) + index)
    return days.find(day => day.date === date) ?? { date, kcal: null, mealCount: 0, revision: 0, confirmedRevision: null }
  }) : []
  const accept = async () => {
    if (!proposal?.ok) return
    if (phases.some(phase => phase.startDate === start) && !window.confirm(`Replace the phase starting ${start}? Earlier phases will stay as they are.`)) return
    setBusy(true); setError('')
    try { await onPhase(proposal.phase); onClose() } catch { setError('Could not save this phase. Your previous plan is still active.') } finally { setBusy(false) }
  }
  const review = async () => {
    setBusy(true); setError('')
    try { await onReview(range.map(({ date, revision }) => ({ date, revision }))) }
    catch (cause) { setError(cause instanceof ApiError && cause.status === 409 ? 'A meal changed while you were reviewing. Reopen this panel and check the latest totals.' : 'Could not confirm these days. Check the date range and try again.') }
    finally { setBusy(false) }
  }
  return <WeightDialog title="Recalculate your plan" closeLabel="Close recalculation" busy={busy} onClose={onClose}>
    <p className="finance-muted">Review the numbers, then accept a phase. Your goal and earlier phases stay fixed.</p>
    <fieldset disabled={busy} className="weight-form">
      <label className="finance-field">Daily burn source<select value={source} onChange={event => setSource(event.target.value)}><option value="observed" disabled={!observed}>Observed · {observed ? `${observed.kcal} kcal/day` : 'needs 28 reviewed days'}</option><option value="profile" disabled={!estimated}>Profile · {estimated ? `${Math.round(estimated.totalKcal)} kcal/day` : 'add your measurements first'}</option><option value="manual" disabled={!current}>Current phase · {current ? `${current.maintenanceKcal} kcal/day` : 'not set'}</option></select></label>
      {source === 'observed' && observed && <small className="finance-muted">{observed.startDate} through {observed.endDate} (food end excluded), {observed.weighIns} weigh-ins. Approximate total expenditure.</small>}
      <label className="finance-field">Phase starts<input type="date" min={today} max={goal ? dateOf(dayNumber(goal.targetDate) - 1) : undefined} value={start} onChange={event => setStart(event.target.value)} /></label>
      {!profile && <p>Add your profile with Estimate daily burn before calculating a suggested intake.</p>}
      {proposal?.ok ? <div className="weight-proposal"><strong>{proposal.phase.intakeKcal} <small>kcal / day</small></strong><p>Estimated burn {proposal.phase.maintenanceKcal} · deficit {proposal.phase.maintenanceKcal - proposal.phase.intakeKcal} kcal/day</p><p>{current ? `Current intake ${current.intakeKcal} kcal/day` : 'Your first calorie phase'} · starts {start}</p><small>Projected seven-day average: {proposal.projectedAverageKg.toFixed(2)} kg on {goal?.targetDate}. Approximate forecast; burn is held constant within each phase.</small></div> : proposal && <p className="finance-notice">{proposal.error}</p>}
      {error && <p role="alert" className="finance-danger">{error}</p>}
      <button type="button" className="finance-primary" disabled={!proposal?.ok} onClick={() => void accept()}>{busy ? 'Saving…' : phases.some(phase => phase.startDate === start) ? 'Accept replacement phase' : 'Accept new phase'}</button>
      <button type="button" onClick={() => setReviewing(!reviewing)}>{reviewing ? 'Hide food review' : 'Review food logs'}</button>
      {reviewing && <section className="weight-review"><h3>Review food coverage</h3><p className="finance-muted">Confirm only days where all food is recorded. An empty day counts as zero only when you confirm it.</p><div className="finance-fields"><label className="finance-field">Review from<input type="date" max={reviewEnd} value={reviewStart} onChange={event => setReviewStart(event.target.value)} /></label><label className="finance-field">Review through<input type="date" min={reviewStart} max={dateOf(dayNumber(foodToday) - 1)} value={reviewEnd} onChange={event => setReviewEnd(event.target.value)} /></label></div><ul>{range.map(day => <li key={day.date}><time>{day.date}</time><span>{day.kcal === null ? 'No food logged' : `${day.kcal} kcal`}</span><small>{day.confirmedRevision === day.revision ? 'Reviewed' : 'Unreviewed'}</small></li>)}</ul><button type="button" disabled={!range.length || reviewEnd >= foodToday} onClick={() => void review()}>Confirm these {range.length} days</button></section>}
    </fieldset>
  </WeightDialog>
}
