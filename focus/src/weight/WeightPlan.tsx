import { useState, type FormEvent } from 'react'
import { dateOf, dayNumber, DEFAULT_PROTEIN_PER_KG, last, localToday, mealDay, trendAt, type FoodDay, type WeightEntry, type WeightGoal, type WeightProfile } from './model'
import { goalArrival, goalOn, goalProgress, observedExpenditure, profileExpenditure } from './goals'
import { formatWeightDate } from './format'
import { ProfileEditor } from './ProfileEditor'
import { WeightDialog } from './WeightDialog'

const signed = (value: number, digits = 2) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}`
type Props = {
  entries: WeightEntry[]; goals: WeightGoal[]; profile: WeightProfile | null; days: FoodDay[]
  onGoal: (date: string, goal: { targetWeightKg: number; targetDate: string; intakeKcal: number | null }) => Promise<unknown>
  onProfile: (profile: WeightProfile) => Promise<unknown>
}

export function WeightPlan(props: Props) {
  const [panel, setPanel] = useState<'goal' | 'profile' | null>(null)
  const [editingGoal, setEditingGoal] = useState<WeightGoal>()
  const today = localToday(), foodToday = mealDay(), goal = goalOn(props.goals, today)
  const observed = observedExpenditure(props.entries, props.days, foodToday)
  const trend = trendAt(props.entries, today)
  const latest = last(props.entries), bodyKg = trend ?? (latest ? trendAt(props.entries, latest.date) ?? undefined : undefined)
  const estimated = props.profile && bodyKg ? profileExpenditure(props.profile, bodyKg) : null
  const burn = observed?.kcal ?? estimated?.totalKcal
  const logged = props.days.filter(day => day.date < foodToday && day.date >= dateOf(dayNumber(foodToday) - 28) && day.mealCount > 0 && day.kcal !== null && Number.isFinite(day.kcal))
  // boffin: the graphic uses logged intake; a chosen calorie target never fills missing food.
  const intake = observed?.averageIntakeKcal ?? (logged.length ? logged.reduce((sum, day) => sum + day.kcal!, 0) / logged.length : undefined)
  const graphic = burn !== undefined && Number.isFinite(burn) && burn > 0 && intake !== undefined && Number.isFinite(intake)
  const progress = goal ? goalProgress(props.entries, goal, goal.targetDate < today ? goal.targetDate : today) : null
  const expired = !!goal && goal.targetDate < today
  const measuredDeadline = !!goal && !!progress && progress.readings >= 4 && props.entries.some(entry => entry.date === goal.targetDate)
  const status = expired ? measuredDeadline ? progress?.reached ? 'Target reached by deadline' : 'Above target at deadline' : 'Insufficient weigh-ins at deadline' : progress?.reached ? 'Target reached' : goal ? `${Math.max(0, dayNumber(goal.targetDate) - dayNumber(today))} days remaining` : ''
  const arrival = goal ? goalArrival(props.entries, goal, today) : null
  const daysAhead = goal && arrival?.status === 'estimated' ? dayNumber(goal.targetDate) - dayNumber(arrival.date) : null
  const arrivalMessages = {
    'insufficient-data': ['A little more history first', 'Four weigh-ins spanning at least seven days let us estimate a goal date.'],
    'needs-weigh-in': ['Add a recent weigh-in', 'Refresh your weight to estimate when you could reach your goal.'],
    'at-goal': ['Latest average is at goal', 'Your latest seven-day average is already at or below your target.'],
    'not-progressing': ['No arrival date at this pace', 'Your recent weight trend is flat or rising.'],
    'long-range': ['More than a year at this pace', 'An exact date would be too uncertain this far ahead.'],
  }
  const arrivalMessage = arrival && arrival.status !== 'estimated' ? arrivalMessages[arrival.status] : null
  return <article className="finance-card weight-goal weight-plan">
    <div className="weight-plan__summary">
      <section className="weight-goal__body"><span className="finance-eyebrow">WEIGHT PLAN</span>
        <div>{goal ? <><strong className="weight-goal__target">{goal.targetWeightKg.toFixed(1)} <small>kg</small></strong><p className="weight-goal__deadline">By <time dateTime={goal.targetDate}>{formatWeightDate(goal.targetDate)}</time></p><small className={progress?.reached ? 'weight-stat--good' : 'finance-muted'}>{status}</small><p className="weight-plan__intake">{goal.intakeKcal != null ? <>Daily intake target <strong>{goal.intakeKcal} kcal</strong></> : <span className="finance-muted">No daily intake target</span>}</p></> : <><strong className="weight-goal__empty">Choose a target weight and date</strong><p className="finance-muted">{props.entries.length ? 'Choose the weight you want to reach and your deadline.' : 'Log your first weight to begin.'}</p></>}</div>
      </section>
      <section className="weight-plan__outlook"><span className="finance-eyebrow">AT YOUR RECENT PACE</span>{goal && arrival?.status === 'estimated' ? <><span className="weight-plan__arrival-label">Reach goal by</span><strong className="weight-plan__arrival-date"><time dateTime={arrival.date}>{formatWeightDate(arrival.date)}</time></strong>{daysAhead !== null && <small className={daysAhead >= 0 ? 'weight-stat--good' : 'weight-stat--bad'}>{daysAhead === 0 ? 'On your goal date' : `${Math.abs(daysAhead)} ${Math.abs(daysAhead) === 1 ? 'day' : 'days'} ${daysAhead > 0 ? 'before' : 'after'} your goal date`}</small>}</> : <><strong>{arrivalMessage?.[0] ?? 'Set a weight goal'}</strong><p>{arrivalMessage?.[1] ?? 'Choose a target to estimate when you could reach it.'}</p></>}</section>
    </div>

    <section className="weight-plan__energy"><div className="finance-card-heading"><span className="finance-eyebrow">LOGGED FOOD &amp; DAILY BURN</span><span className="finance-muted">{observed ? 'Food + weight evidence' : 'Food + activity estimate'}</span></div>
      {observed && observed.kcal <= 0 && <p className="finance-muted">This window implies {observed.kcal} kcal/day, which cannot represent daily burn. Missing food and short-term weight changes can distort the estimate; new records will update it.</p>}
      {graphic ? <EnergyBar maintenance={Math.round(burn!)} intake={Math.round(intake!)} burnLabel={observed ? 'Observed burn' : 'Estimated burn'} /> : <p className="finance-muted">{intake === undefined ? 'Log food to compare your actual intake with daily burn. Missing days stay unknown.' : 'Add your measurements or more food and weight data to compare intake with burn.'}</p>}
      <dl className="weight-plan__figures"><div><dt>Protein target</dt><dd>{bodyKg ? Math.round(bodyKg * DEFAULT_PROTEIN_PER_KG) : '—'} <small>g/day · 1.5 g/kg</small></dd></div><div><dt><span>Daily burn estimate</span><button type="button" className="weight-plan__edit-estimate" aria-label={props.profile ? 'Edit metabolism and activity' : 'Estimate daily burn'} title={props.profile ? 'Edit metabolism and activity' : 'Estimate daily burn'} onClick={() => setPanel('profile')} disabled={!props.entries.length}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m16.9 2.6 4.5 4.5-2.8 2.8-4.5-4.5 2.8-2.8ZM3 17l9.7-9.7 4.5 4.5L7.5 21H3v-4Z" /></svg></button></dt><dd>{estimated ? Math.round(estimated.totalKcal) : '—'} <small>kcal/day</small></dd></div></dl>
      {observed ? <p className="finance-muted weight-plan__evidence">Based on {observed.foodDays} {observed.foodDays === 1 ? 'day' : 'days'} of food logs and {observed.weighIns} {observed.weighIns === 1 ? 'weigh-in' : 'weigh-ins'}.{observed.provisional ? ' Early estimate.' : ''}</p> : <p className="finance-muted weight-plan__evidence">{estimated ? `Burn is a profile estimate${estimated.legacyActivity ? ' using your saved activity factor' : ' from resting metabolism, walking and workouts'}. ` : ''}{logged.length ? `Food average uses ${logged.length} logged ${logged.length === 1 ? 'day' : 'days'} in the past 28 days. ` : ''}Observed burn appears when logged food lines up with two boundary weigh-ins. Missing food is never counted as zero.</p>}
    </section>
    <div className="weight-plan__phases">
    <details className="weight-plan__past"><summary>Goal phases · {props.goals.length}</summary><section className="weight-plan__versions"><h3>Weight goal phases</h3>{props.goals.length ? <ol>{[...props.goals].sort((a, b) => b.startDate.localeCompare(a.startDate)).map(value => <li className={value === goal ? 'is-current' : undefined} key={value.startDate}><div><time dateTime={value.startDate}>From {formatWeightDate(value.startDate)}</time><strong>{value.targetWeightKg.toFixed(1)} kg <small>by {formatWeightDate(value.targetDate)}</small></strong><small className="finance-muted">{value.intakeKcal != null ? `${value.intakeKcal} kcal/day` : 'No daily intake target'}</small></div><button type="button" aria-label={`Edit phase starting ${formatWeightDate(value.startDate)}`} onClick={() => { setEditingGoal(value); setPanel('goal') }}>Edit</button></li>)}</ol> : <p className="finance-muted">Start your first phase with a weight and a date. You can add a daily calorie target too.</p>}</section></details><button type="button" className="weight-plan__new-phase" disabled={!props.entries.length} onClick={() => { setEditingGoal(undefined); setPanel('goal') }}>Start new phase</button>
    </div>
    {panel === 'goal' && <GoalEditor entries={props.entries} goals={props.goals} goal={editingGoal} initialGoal={goal} onSave={props.onGoal} onClose={() => setPanel(null)} />}
    {panel === 'profile' && <ProfileEditor profile={props.profile} weightKg={bodyKg!} onSave={props.onProfile} onClose={() => setPanel(null)} />}
  </article>
}

function GoalEditor({ entries, goals, goal, initialGoal, onSave, onClose }: { entries: WeightEntry[]; goals: WeightGoal[]; goal?: WeightGoal; initialGoal?: WeightGoal; onSave: Props['onGoal']; onClose: () => void }) {
  const today = localToday(), initial = goal ?? initialGoal
  const [start, setStart] = useState(goal?.startDate ?? today)
  const [target, setTarget] = useState(initial ? String(initial.targetWeightKg) : '')
  const [date, setDate] = useState(goal?.targetDate ?? (initial && initial.targetDate > today ? initial.targetDate : dateOf(dayNumber(today) + 60)))
  const [intake, setIntake] = useState(initial?.intakeKcal == null ? '' : String(initial.intakeKcal))
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!goal && goals.some(value => value.startDate === start) && !window.confirm(`A goal phase already starts on ${formatWeightDate(start)}. Replace it with this goal?`)) return
    setBusy(true); setError('')
    try { await onSave(start, { targetWeightKg: Number(target), targetDate: date, intakeKcal: intake === '' ? null : Number(intake) }); onClose() }
    catch { setError('Could not save this phase. Check the weight, dates and calories; your draft is still here.') }
    finally { setBusy(false) }
  }
  return <WeightDialog title={goal ? 'Edit goal phase' : 'Start a goal phase'} closeLabel="Close goal" dirty={dirty} busy={busy} onClose={onClose}>
    <p className="finance-muted">Your weight and date set the target line. An optional calorie budget also appears in Food and your Telegram meal summaries.</p>
    <form onSubmit={submit} onChange={() => setDirty(true)}><fieldset disabled={busy} className="weight-form">
      <label className="finance-field">Phase starts<input type="date" required readOnly={!!goal} max={today} value={start} onChange={event => setStart(event.target.value)} /></label>
      <div className="weight-phase-editor__destination"><label className="finance-field">Target weight (kg)<input type="number" inputMode="decimal" required min="20" max="400" step="0.05" value={target} placeholder={entries.length ? String(last(entries)!.weightKg) : ''} onChange={event => setTarget(event.target.value)} /></label><label className="finance-field">Target date<input type="date" required min={dateOf((goal ? dayNumber(start) : Math.max(dayNumber(start), dayNumber(today))) + 1)} value={date} onChange={event => setDate(event.target.value)} /></label></div>
      <label className="finance-field">Daily intake target (optional)<input type="number" inputMode="numeric" min="0" max="10000" step="1" value={intake} placeholder="No daily target" onChange={event => setIntake(event.target.value)} /></label>
      <small className="finance-muted">kcal per day. Leave blank for no calorie budget during this phase.</small>
      {error && <p role="alert" className="finance-danger">{error}</p>}
      <button className="finance-primary">{busy ? 'Saving…' : 'Save goal phase'}</button>
    </fieldset></form>
  </WeightDialog>
}

function EnergyBar({ maintenance, intake, burnLabel }: { maintenance: number; intake: number; burnLabel: string }) {
  const scale = Math.max(maintenance, intake, 1), gap = maintenance - intake
  return <figure className="weight-energy" role="img" aria-label={`Average eaten ${intake} kcal per day; ${burnLabel.toLowerCase()} ${maintenance} kcal per day; energy difference ${intake - maintenance} kcal per day`}>
    <figcaption className="weight-energy__labels"><span><small>Average eaten</small><strong>{intake} <small>kcal/day</small></strong></span><span><small>{burnLabel}</small><strong>{maintenance} <small>kcal/day</small></strong></span></figcaption>
    <div className="weight-energy__track"><div className="weight-energy__intake" style={{ width: `${Math.min(intake, maintenance) / scale * 100}%` }} />{gap !== 0 && <div className={`weight-energy__gap weight-energy__gap--${gap > 0 ? 'deficit' : 'surplus'}`} style={{ width: `${Math.abs(gap) / scale * 100}%` }} />}<i className="weight-energy__marker" style={{ left: `${maintenance / scale * 100}%` }} /></div>
    <div className={`weight-energy__difference${gap > 0 ? ' weight-stat--good' : gap < 0 ? ' weight-stat--bad' : ''}`}><span>Energy difference</span><strong>{signed(intake - maintenance, 0)} <small>kcal/day</small></strong></div>
  </figure>
}
