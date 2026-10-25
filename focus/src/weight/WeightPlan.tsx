import { useState, type FormEvent } from 'react'
import { dateOf, dayNumber, DEFAULT_PROTEIN_PER_KG, KCAL_PER_KG, last, localToday, mealDay, movingAverage, phaseOn, type FoodDay, type Phase, type WeightEntry, type WeightGoal, type WeightProfile } from './model'
import { goalOn, goalProgress, observedExpenditure, profileExpenditure, suggestPhase } from './goals'
import { WeightDialog } from './WeightDialog'

const signed = (value: number, digits = 2) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}`
const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })
type Props = {
  entries: WeightEntry[]; phases: Phase[]; goals: WeightGoal[]; profile: WeightProfile | null; days: FoodDay[]
  onGoal: (date: string, goal: { targetWeightKg: number; targetDate: string }) => Promise<unknown>
  onProfile: (profile: WeightProfile) => Promise<unknown>
  onPhase: (phase: Phase) => Promise<unknown>
  onDeletePhase: (date: string) => Promise<unknown>
}

export function WeightPlan(props: Props) {
  const [panel, setPanel] = useState<'goal' | 'profile' | null>(null)
  const [preferActivity, setPreferActivity] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('')
  const today = localToday(), foodToday = mealDay(), goal = goalOn(props.goals, today), current = phaseOn(props.phases, today)
  const observed = observedExpenditure(props.entries, props.days, foodToday)
  const bodyKg = last(movingAverage(props.entries))
  const estimated = props.profile && bodyKg ? profileExpenditure(props.profile, bodyKg) : null
  const burn = preferActivity && estimated ? estimated.totalKcal : observed?.kcal ?? estimated?.totalKcal ?? current?.maintenanceKcal
  const usableBurn = burn !== undefined && Number.isFinite(burn) && burn >= 500 && burn <= 10000
  const proposal = goal && props.profile && burn !== undefined ? suggestPhase(props.entries, props.phases, goal, props.profile, burn, today) : null
  const displayed = proposal?.ok ? proposal.phase : current ? usableBurn ? { ...current, maintenanceKcal: Math.round(burn!) } : current : null
  const changed = proposal?.ok && (!current || current.intakeKcal !== proposal.phase.intakeKcal || current.maintenanceKcal !== proposal.phase.maintenanceKcal)
  const expired = !!goal && goal.targetDate < today
  const progress = goal ? goalProgress(props.entries, goal, expired ? goal.targetDate : today) : null
  const deadlineMeasured = !!goal && !!progress && progress.readings >= 4 && props.entries.some(entry => entry.date === goal.targetDate)
  const status = expired ? deadlineMeasured ? progress?.reached ? 'Target reached by deadline' : 'Above target at deadline' : 'Insufficient weigh-ins at deadline' : progress?.reached ? 'Target reached' : goal ? `${Math.max(0, dayNumber(goal.targetDate) - dayNumber(today))} days remaining` : ''
  const apply = async () => {
    if (!proposal?.ok || saving) return
    if (props.phases.some(phase => phase.startDate === today) && !window.confirm('Replace today’s saved phase with this updated plan?')) return
    setSaving(true); setError('')
    try { await props.onPhase(proposal.phase) } catch { setError('Could not save this plan. Your saved phase is still active.') } finally { setSaving(false) }
  }
  const loggedFoodDays = props.days.filter(day => day.date < foodToday && day.kcal !== null).length
  const needsRecentWeight = loggedFoodDays >= 7 && !!last(props.entries) && last(props.entries)!.date < foodToday
  return <article className="finance-card weight-goal weight-plan">
    <div className="finance-card-heading"><span className="finance-eyebrow">WEIGHT PLAN</span><button type="button" onClick={() => setPanel('goal')} disabled={!props.entries.length}>{goal ? 'Change goal' : 'Set goal'}</button></div>
    <div className="weight-goal__body">
      <div>{goal ? <><strong className="weight-goal__target">{goal.targetWeightKg.toFixed(1)} <small>kg</small></strong><p>Seven-day average by <time>{goal.targetDate}</time></p><small className={progress?.reached ? 'weight-stat--good' : 'finance-muted'}>{status}</small></> : <><strong className="weight-goal__empty">Choose a target weight and date</strong><p className="finance-muted">{props.entries.length ? 'Your metabolism and activity set the daily plan.' : 'Log your first weight to begin.'}</p></>}</div>
      <dl className="weight-goal__estimates">
        <div><dt>Resting metabolism</dt><dd>{estimated ? `${Math.round(estimated.restingKcal)} kcal/day` : 'Not set'}</dd><small>{estimated ? 'Before movement and food digestion' : 'Add your measurements below'}</small></div>
        <div><dt>Daily burn estimate</dt><dd>{burn !== undefined ? `${Math.round(burn)} kcal/day` : 'Not set'}</dd><small>{observed && !preferActivity ? `${observed.foodDays} days of food + weight${observed.provisional ? ' · early estimate' : ''}` : estimated ? estimated.legacyActivity ? 'Previous activity estimate · update your steps and sport' : 'Resting + daily movement + sport' : 'From your saved phase'}</small></div>
      </dl>
    </div>
    {observed ? <p className="finance-muted weight-plan__evidence">Food-based burn: {observed.kcal} kcal/day · {observed.foodDays}-day window · {observed.weighIns} weigh-ins.{observed.provisional ? ' Early estimate; daily weight fluctuations have more influence.' : ' Uses the latest available food and weight window.'} Based on the food logged.</p> : <p className="finance-muted weight-plan__evidence">{needsRecentWeight ? 'Add a recent weigh-in to calculate burn from your food logs.' : 'Food-based burn starts with 7 days of overlapping food and weight data, then builds up to 28 days automatically.'}</p>}
    {observed && estimated && <label className="finance-field weight-plan__source">Plan based on<select value={preferActivity ? 'activity' : 'observed'} onChange={event => setPreferActivity(event.target.value === 'activity')}><option value="observed">Food and weight trend{observed.provisional ? ' · early estimate' : ''}</option><option value="activity">Steps and sport estimate</option></select></label>}
    {burn !== undefined && !usableBurn && <p className="finance-muted">This estimate is outside the planning range. Check for missing food or allow more weight data; your saved phase stays active.</p>}
    {displayed && <div className="weight-plan__now"><small>{proposal?.ok ? changed ? 'Updated recommendation' : 'Current plan' : usableBurn ? 'Current intake against this burn estimate' : 'Saved plan'}</small>
      <EnergyBar maintenance={displayed.maintenanceKcal} intake={displayed.intakeKcal} />
      <dl className="weight-plan__figures"><div><dt>Daily intake</dt><dd>{displayed.intakeKcal} <small>kcal</small></dd></div><div><dt>Deficit</dt><dd>{signed(displayed.intakeKcal - displayed.maintenanceKcal, 0)} <small>kcal/day</small></dd></div><div><dt>Per week</dt><dd>{signed((displayed.intakeKcal - displayed.maintenanceKcal) * 7 / KCAL_PER_KG)} <small>kg</small></dd></div><div><dt>Protein</dt><dd>{bodyKg ? Math.round(bodyKg * DEFAULT_PROTEIN_PER_KG) : '—'} <small>g/day · 1.5 g/kg</small></dd></div></dl>
    </div>}
    {proposal && !proposal.ok && <p className="finance-notice">{proposal.error}</p>}
    {changed && current && <p className="finance-muted">Saved intake: {current.intakeKcal} kcal/day. Apply the recommendation to update your plan.</p>}
    {error && <p role="alert" className="finance-danger">{error}</p>}
    <div className="weight-plan__actions"><button type="button" onClick={() => setPanel('profile')} disabled={!props.entries.length}>{props.profile ? 'Edit metabolism and activity' : 'Estimate daily burn'}</button>{proposal?.ok && (changed ? <button type="button" disabled={saving} className="finance-primary" onClick={() => void apply()}>{saving ? 'Saving…' : 'Apply updated plan'}</button> : <span className="weight-plan__saved">Plan is up to date</span>)}</div>
    <details className="weight-plan__past"><summary>Plan history · {props.phases.length} saved {props.phases.length === 1 ? 'phase' : 'phases'}</summary><PhaseHistory phases={props.phases} defaultStart={props.entries[0]?.date ?? today} onSave={props.onPhase} onDelete={props.onDeletePhase} /></details>
    {panel === 'goal' && <GoalEditor entries={props.entries} goal={goal} onSave={props.onGoal} onClose={() => setPanel(null)} />}
    {panel === 'profile' && <ProfileEditor profile={props.profile} weightKg={bodyKg!} onSave={props.onProfile} onClose={() => setPanel(null)} />}
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
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex ?? 'male'), [steps, setSteps] = useState(profile?.stepsPerDay == null ? '' : String(profile.stepsPerDay))
  const [sport, setSport] = useState<NonNullable<WeightProfile['sport']>>(profile?.sport ?? 'none'), [minutes, setMinutes] = useState(String(profile?.sportMinutes ?? 45)), [sessions, setSessions] = useState(String(profile?.sportDaysPerWeek ?? 3))
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const draft: WeightProfile = { age: Number(age), heightCm: Number(height), sex, activityFactor: 1.2, stepsPerDay: Number(steps), sport, sportMinutes: sport === 'none' ? 0 : Number(minutes), sportDaysPerWeek: sport === 'none' ? 0 : Number(sessions) }
  const estimate = age && height && steps !== '' ? profileExpenditure(draft, weightKg) : null
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await onSave(draft); onClose() } catch { setError('Could not save your estimate. Check the measurements and try again.') } finally { setBusy(false) }
  }
  return <WeightDialog title="Metabolism and daily activity" closeLabel="Close estimate" dirty={dirty} busy={busy} onClose={onClose}>
    <p className="finance-muted">Your measurements estimate resting metabolism. Steps and sport add movement, averaged across your week.</p>
    <form onSubmit={submit} onChange={() => setDirty(true)}><fieldset disabled={busy} className="weight-form">
      <p>Using your current trend: <strong>{weightKg.toFixed(2)} kg</strong></p>
      <div className="finance-fields"><label className="finance-field">Age<input type="number" required min="20" max="120" step="1" value={age} onChange={event => setAge(event.target.value)} /></label><label className="finance-field">Height (cm)<input type="number" required min="100" max="250" step="0.1" value={height} onChange={event => setHeight(event.target.value)} /></label></div>
      <label className="finance-field">Equation sex<select value={sex} onChange={event => setSex(event.target.value as 'male' | 'female')}><option value="male">Male</option><option value="female">Female</option></select></label>
      <label className="finance-field">Steps per day<input type="number" required min="0" max="100000" step="1" value={steps} onChange={event => setSteps(event.target.value)} placeholder="Your usual daily average" /></label>
      <label className="finance-field">Sport<select value={sport} onChange={event => setSport(event.target.value as NonNullable<WeightProfile['sport']>)}><option value="none">No regular sport</option><option value="strength">Strength training</option><option value="cycling">Cycling</option><option value="running">Running / jogging</option><option value="swimming">Swimming</option></select></label>
      {sport !== 'none' && <div className="finance-fields"><label className="finance-field">Minutes per session<input type="number" required min="1" max="600" step="1" value={minutes} onChange={event => setMinutes(event.target.value)} /></label><label className="finance-field">Sessions per week<input type="number" required min="0" max="14" step="0.5" value={sessions} onChange={event => setSessions(event.target.value)} /></label></div>}
      {estimate && <div className="weight-proposal"><strong>{Math.round(estimate.totalKcal)} kcal / day</strong><dl className="weight-activity__breakdown"><div><dt>Resting</dt><dd>{Math.round(estimate.restingKcal)}</dd></div><div><dt>Background</dt><dd>{Math.round(estimate.backgroundKcal)}</dd></div><div><dt>Steps</dt><dd>{Math.round(estimate.stepsKcal)}</dd></div><div><dt>Sport average</dt><dd>{Math.round(estimate.sportKcal)}</dd></div></dl><small>A starting estimate. Food and weight data refine the picture over time.</small></div>}
      {error && <p role="alert" className="finance-danger">{error}</p>}<button className="finance-primary">{busy ? 'Saving…' : 'Save estimate'}</button>
    </fieldset></form>
  </WeightDialog>
}

function EnergyBar({ maintenance, intake }: { maintenance: number; intake: number }) {
  const scale = Math.max(maintenance, intake, 1)
  const gap = maintenance - intake
  return <div className="weight-energy" role="img" aria-label={`Eating ${intake} of ${maintenance} kcal`}>
    <div className="weight-energy__intake" style={{ width: `${Math.min(intake, maintenance) / scale * 100}%` }}><span>{intake} in</span></div>
    {gap !== 0 && <div className={`weight-energy__gap weight-energy__gap--${gap > 0 ? 'deficit' : 'surplus'}`} style={{ width: `${Math.abs(gap) / scale * 100}%` }}><span>{gap > 0 ? '−' : '+'}{Math.abs(gap)}</span></div>}
    <i className="weight-energy__marker" style={{ left: `${maintenance / scale * 100}%` }}><span>{maintenance} burn</span></i>
  </div>
}

function PhaseHistory({ phases, defaultStart, onSave, onDelete }: { phases: Phase[]; defaultStart: string; onSave: (phase: Phase) => Promise<unknown>; onDelete: (date: string) => Promise<unknown> }) {
  const today = localToday()
  const current = phaseOn(phases, today) ?? phases[0]
  const [saveError, setSaveError] = useState(''), [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [startDate, setStartDate] = useState(phases.length ? today : defaultStart)
  const [maintenance, setMaintenance] = useState(current ? String(current.maintenanceKcal) : '')
  const [intake, setIntake] = useState(current ? String(current.intakeKcal) : '')
  const perWeek = (phase: Phase) => (phase.maintenanceKcal - phase.intakeKcal) * 7 / KCAL_PER_KG
  const edit = (phase: Phase) => { setStartDate(phase.startDate); setMaintenance(String(phase.maintenanceKcal)); setIntake(String(phase.intakeKcal)); setEditing(true) }
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setSaveError(''); try { await onSave({ startDate, maintenanceKcal: Number(maintenance), intakeKcal: Number(intake), proteinPerKg: DEFAULT_PROTEIN_PER_KG }); setEditing(false) } catch { setSaveError('Could not save this phase. Your draft is still here.') } finally { setSaving(false) } }
  const draft = { startDate, maintenanceKcal: Number(maintenance), intakeKcal: Number(intake) }
  const draftValid = maintenance !== '' && intake !== '' && draft.maintenanceKcal >= 500
  return <section className="weight-plan__history">
    <div className="finance-card-heading"><span className="finance-eyebrow">Saved phases</span>
      {!editing && <button type="button" onClick={() => { setStartDate(today); setEditing(true) }}>Set manually</button>}</div>
    {editing && <form className="weight-plan__form" onSubmit={submit}><fieldset disabled={saving} className="weight-form">
      {!phases.length && <p className="finance-muted">Set your daily burn and intake manually.</p>}
      <div className="finance-fields">
        <label className="finance-field">From<input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label className="finance-field">Burn (maintenance)<input type="number" required min="500" max="10000" step="1" placeholder="2300" value={maintenance} onChange={e => setMaintenance(e.target.value)} /></label>
        <label className="finance-field">Eat (intake)<input type="number" required min="0" max="10000" step="1" placeholder="1800" value={intake} onChange={e => setIntake(e.target.value)} /></label>
      </div>
      {draftValid && <><EnergyBar maintenance={draft.maintenanceKcal} intake={draft.intakeKcal} /><p className="weight-plan__preview">{signed(-perWeek(draft))} kg / week</p></>}
      {saveError && <p role="alert" className="finance-danger">{saveError}</p>}
      <div className="weight-plan__actions">
        <button type="submit" disabled={saving} className="finance-primary">{phases.some(phase => phase.startDate === startDate) ? 'Save phase' : 'Add phase'}</button>
        {phases.length > 0 && <button type="button" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </fieldset></form>}
    {phases.length > 0 && <ol className="weight-plan__timeline">{[...phases].reverse().map(phase => <li key={phase.startDate} className={phase === current ? 'is-current' : undefined}>
      <button type="button" disabled={saving} className="weight-plan__phase" onClick={() => edit(phase)} aria-label={`Edit phase from ${shortDate(phase.startDate)}`}>
        <time>{shortDate(phase.startDate)}</time><span>{phase.intakeKcal} / {phase.maintenanceKcal} kcal</span><strong>{signed(-perWeek(phase))} kg/wk</strong>
      </button>
      <button type="button" disabled={saving} className="finance-remove" aria-label={`Delete phase from ${phase.startDate}`} onClick={() => { if (window.confirm(`Delete the phase starting ${shortDate(phase.startDate)}?`)) void onDelete(phase.startDate).catch(() => undefined) }}>×</button>
    </li>)}</ol>}
  </section>
}
