import { useCallback, useEffect, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { useAuth, SignIn, UserButton } from '@clerk/clerk-react'
import { AppHeader } from '@/components/AppHeader'
import { useAuthSync } from '@/hooks/useAuthSync'
import { ApiError, del, get, post, put } from '@/api/client'
import { analyse, dateOf, DEFAULT_PROTEIN_PER_KG, last, mealDay, phaseOn, streakBefore, type Meal, dayNumber, KCAL_PER_KG, localToday, movingAverage, parseSheetRows, type Phase, type WeightEntry } from './model'
import '@/finance/finance.css'
import './weight.css'
import { Food } from './Food'
import { WeightPlan } from './WeightPlan'
import { DayDrawer } from './DayDrawer'
import { forecast, goalOn, goalProgress, goalReference, observedExpenditure } from './goals'
import type { FoodDay, WeightGoal, WeightProfile } from './model'

const kg = (value: number, digits = 2) => `${value.toFixed(digits)} kg`
const signed = (value: number, digits = 2) => { const rounded = Number(value.toFixed(digits)); return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${Math.abs(rounded).toFixed(digits)}` }
const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })

export function WeightApp() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isReady } = useAuthSync()
  if (!isLoaded) return <p className="finance-loading">Loading sign-in…</p>
  if (!isSignedIn) return <main className="finance-app"><div className="finance-gate"><span className="finance-eyebrow">FOCUS / WEIGHT</span><h1>Sign in to Weight</h1><SignIn forceRedirectUrl="/weight.html" signUpForceRedirectUrl="/weight.html" /><a href="/">← Back to Focus</a></div></main>
  return <WeightPage isReady={isReady} account={<UserButton appearance={{ elements: { avatarBox: 'user-avatar' } }} />} />
}

export function WeightPage({ isReady, account }: { isReady: boolean; account: ReactNode }) {
  return <main className="finance-app weight-app">
    <AppHeader mode="weight">{account}</AppHeader>
    {isReady ? <Weight /> : <p className="finance-loading">Loading…</p>}
  </main>
}

function Weight() {
  const [data, setData] = useState<WeightData | null>(null)
  const [error, setError] = useState('')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const load = useCallback(async () => { setData(await get<WeightData>('/weight')) }, [])
  useEffect(() => { void load().catch(() => setError('Could not load your weight log.')) }, [load])
  // boffin: failed saves reject so an editor keeps its draft instead of closing as if it saved.
  const run = async (action: Promise<unknown>) => {
    setError('')
    try { await action } catch (cause) { setError('Could not save. Try again.'); throw cause }
    await load().catch(() => setError('Saved, but this view could not refresh. Reload to see the latest data.'))
  }

  if (!data) return error ? <p role="alert" className="finance-notice">{error}</p> : <p className="finance-loading">Loading…</p>
  const { entries, phases, meals, profile, goals, days } = data
  const foodDay = mealDay()
  const bodyKg = entries.length ? last(movingAverage(entries)) : undefined
  return <>
    {error && <p role="alert" className="finance-notice">{error}</p>}
    {!entries.some(entry => entry.date === localToday()) && <TodayForm entries={entries} goals={goals} onSave={weightKg => run(put(`/weight/entries/${localToday()}`, { weightKg }))} />}
    <Stats entries={entries} goals={goals} days={days} />
    {entries.length > 0 && <Chart entries={entries} phases={phases} goals={goals} />}
    <WeightPlan entries={entries} phases={phases} profile={profile} goals={goals} days={days}
      onGoal={(date, goal) => run(put(`/weight/goals/${date}`, goal))} onProfile={value => run(put('/weight/profile', value))}
      onPhase={phase => run(put(`/weight/phases/${phase.startDate}`, phase))}
      onReview={value => run(put('/weight/day-reviews', { days: value, complete: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }))} />
    <div className="weight-columns">
      <div className="weight-food-today"><Food meals={meals.filter(meal => meal.date === foodDay)} phase={phaseOn(phases, foodDay)} bodyKg={bodyKg}
        onAdd={(text, image) => run(post<object, Meal>('/meals', { text, image, date: foodDay, language: navigator.language }))}
        onUpdate={(id, kcal) => run(put(`/meals/${id}`, { kcal }))} onDelete={id => run(del(`/meals/${id}`))} /><button type="button" className="weight-food-today__open" onClick={() => setSelectedDay(foodDay)}>View and edit this day</button></div>
      <Phases phases={phases} bodyKg={bodyKg} defaultStart={entries[0]?.date ?? localToday()} onSave={phase => run(put(`/weight/phases/${phase.startDate}`, { maintenanceKcal: phase.maintenanceKcal, intakeKcal: phase.intakeKcal, proteinPerKg: phase.proteinPerKg }))}
        onDelete={date => run(del(`/weight/phases/${date}`))} />
    </div>
    <Drawer title="HISTORY" meta={`${entries.length} weigh-ins · ${days.length} days logged`} open={!entries.length}>
      <Log entries={entries} goals={goals} days={days} onOpen={setSelectedDay}
        onImport={rows => run(Promise.all(rows.map(entry => put(`/weight/entries/${entry.date}`, { weightKg: entry.weightKg }))))}
        onDelete={date => run(del(`/weight/entries/${date}`))} />
    </Drawer>
    {selectedDay && <DayDrawer key={selectedDay} date={selectedDay} entries={entries} phases={phases} onChange={load} onClose={() => setSelectedDay(null)} />}
    <TelegramCard />
  </>
}

type WeightData = { entries: WeightEntry[]; phases: Phase[]; meals: Meal[]; profile: WeightProfile | null; goals: WeightGoal[]; days: FoodDay[] }

function Stats({ entries, goals, days }: { entries: WeightEntry[]; goals: WeightGoal[]; days: FoodDay[] }) {
  const result = analyse(entries)
  if (!result) return null
  const latest = last(entries)!, goal = goalOn(goals, localToday())
  const target = goalReference(goals, latest.date).find(point => point.date === latest.date)
  const observed = observedExpenditure(entries, days, mealDay())
  const progress = goal ? goalProgress(entries, goal, latest.date) : null
  const tiles: [string, string, string, string?][] = [
    ['7-day average', kg(result.trendKg), `${progress?.readings ?? entries.filter(entry => dayNumber(entry.date) > dayNumber(latest.date) - 7).length}/7 readings · last ${kg(latest.weightKg)}`],
    ['Since start', `${signed(result.changeKg)} kg`, `From ${kg(entries[0].weightKg)} on ${shortDate(entries[0].date)}`, result.changeKg <= 0 ? 'good' : 'bad'],
    ['Vs target', target ? `${signed(result.trendKg - target.weightKg)} kg` : '—', target ? progress?.reached ? 'Target average reached' : 'Seven-day average vs target' : goal ? 'See your goal and deadline below' : 'Set a target weight and date', target ? result.trendKg <= target.weightKg ? 'good' : 'bad' : undefined],
    ['Pace / week', result.kgPerWeek === null ? '—' : `${signed(result.kgPerWeek)} kg`, result.kgPerWeek === null ? 'Needs a week of data' : 'Observed, last three weeks'],
    ['Observed daily burn', observed ? `${observed.kcal} kcal` : '—', observed ? `${observed.foodDays} reviewed days · ${observed.weighIns} weigh-ins` : 'Needs 28 complete food days'],
  ]
  return <section className="weight-stats">{tiles.map(([label, value, note, tone]) => <div key={label} className="finance-card weight-stat"><span className="finance-eyebrow">{label}</span><strong className={tone ? `weight-stat--${tone}` : undefined}>{value}</strong><small>{note}</small></div>)}</section>
}

function Chart({ entries, phases, goals }: { entries: WeightEntry[]; phases: Phase[]; goals: WeightGoal[] }) {
  const trend = movingAverage(entries)
  const currentGoal = goalOn(goals, localToday())
  const end = dateOf(Math.max(dayNumber(last(entries)!.date), dayNumber(localToday()) + 14, currentGoal ? dayNumber(currentGoal.targetDate) : 0))
  const goal = goalReference(goals, end)
  const predicted = phases.length ? forecast(entries, phases, end) : []
  const projectedRows = [...entries, ...predicted]
  const projectedTrend = movingAverage(projectedRows)
  const projection = projectedRows.map((entry, index) => ({ date: entry.date, weightKg: projectedTrend[index] })).filter(entry => entry.date >= last(entries)!.date)
  const values = [...entries.map(entry => entry.weightKg), ...goal.map(point => point.weightKg), ...projection.map(point => point.weightKg)]
  const top = Math.ceil(Math.max(...values) * 2 + 1) / 2, bottom = Math.floor(Math.min(...values) * 2 - 1) / 2
  const startDay = dayNumber(entries[0].date), days = Math.max(1, dayNumber(end) - startDay)
  const x = (date: string) => (dayNumber(date) - startDay) / days * 1000
  const y = (value: number) => (top - value) / (top - bottom) * 300
  const path = (points: [string, number][]) => points.map(([date, value], i) => `${i ? 'L' : 'M'}${x(date).toFixed(1)},${y(value).toFixed(1)}`).join('')
  const ticks = Array.from({ length: 5 }, (_, i) => top - (top - bottom) * i / 4)
  const [hover, setHover] = useState<number | null>(null)
  const hovered = hover === null ? null : dateOf(startDay + hover)
  const hoveredIndex = entries.findIndex(entry => entry.date === hovered)
  const hoveredGoal = goal.find(point => point.date === hovered)
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    setHover(Math.min(days, Math.max(0, Math.round((event.clientX - box.left) / box.width * days))))
  }
  return <article className="finance-card weight-chart">
    <div className="finance-card-heading"><span className="finance-eyebrow">PROGRESS</span>
      <div className="weight-chart__legend"><span><i className="weight-key--raw" />Weigh-ins</span><span><i className="weight-key--trend" />7-day average</span>{goal.length > 0 && <span><i className="weight-key--goal" />Target</span>}{predicted.length > 0 && <span><i className="weight-key--forecast" />Forecast · approximate</span>}</div></div>
    <div className="weight-chart__plot" onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
      <div className="weight-chart__scale">{ticks.map(tick => <span key={tick} style={{ top: `${(top - tick) / (top - bottom) * 100}%` }}>{tick.toFixed(1)}</span>)}</div>
      {/* Stretched to fit; non-scaling strokes and zero-length round caps keep lines and dots crisp. */}
      <svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="img" aria-label="Weight, seven-day average, fixed target and approximate forecast over time">
        {ticks.map(tick => <line key={tick} className="weight-chart__grid" x1="0" x2="1000" y1={y(tick)} y2={y(tick)} />)}
        <line className="weight-chart__today" x1={x(localToday())} x2={x(localToday())} y1="0" y2="300" />
        {goal.length > 0 && <path className="weight-chart__goal" d={path(goal.map(point => [point.date, point.weightKg]))} />}
        {predicted.length > 0 && <path className="weight-chart__forecast" d={path(projection.map(point => [point.date, point.weightKg]))} />}
        <path className="weight-chart__raw" d={path(entries.map(entry => [entry.date, entry.weightKg]))} />
        {entries.map(entry => <path key={entry.date} className="weight-chart__dot" d={`M${x(entry.date)},${y(entry.weightKg)}h0`} />)}
        <path className="weight-chart__trend" d={path(entries.map((entry, i) => [entry.date, trend[i]]))} />
        {hovered && <line className="weight-chart__cursor" x1={x(hovered)} x2={x(hovered)} y1="0" y2="300" />}
        {hoveredIndex >= 0 && <path className="weight-chart__dot weight-chart__dot--active" d={`M${x(hovered!)},${y(entries[hoveredIndex].weightKg)}h0`} />}
      </svg>
      {/* Shifting by the same percentage as the offset keeps the tooltip inside the plot at both edges. */}
      {hovered && <div className="weight-chart__tooltip" style={{ left: `${hover! / days * 100}%`, transform: `translateX(-${hover! / days * 100}%)` }}>
        <time>{shortDate(hovered)}</time>
        <span>Weigh-in <strong>{hoveredIndex >= 0 ? kg(entries[hoveredIndex].weightKg) : '—'}</strong></span>
        <span>7-day average <strong>{hoveredIndex >= 0 ? kg(trend[hoveredIndex]) : '—'}</strong></span>
        {hoveredGoal && <span>Goal <strong>{kg(hoveredGoal.weightKg)}</strong></span>}
        {hoveredIndex >= 0 && hoveredGoal && <span>Vs goal <strong className={trend[hoveredIndex] - hoveredGoal.weightKg <= 0 ? 'weight-stat--good' : 'weight-stat--bad'}>{signed(trend[hoveredIndex] - hoveredGoal.weightKg)} kg</strong></span>}
      </div>}
    </div>
    <div className="weight-chart__dates"><span>{shortDate(entries[0].date)}</span><span>{shortDate(dateOf(startDay + Math.round(days / 2)))}</span><span>{shortDate(end)}</span></div>
  </article>
}

function TodayForm({ entries, goals, onSave }: { entries: WeightEntry[]; goals: WeightGoal[]; onSave: (weightKg: number) => Promise<unknown> }) {
  const today = localToday()
  const previous = last(entries)
  const [weight, setWeight] = useState('')
  const value = Number(weight)
  const valid = weight !== '' && value >= 20 && value <= 400
  const goal = goalReference(goals, today).find(point => point.date === today)
  const streak = streakBefore(entries, today)
  // Steppers start from the last weigh-in so a typical day is a couple of taps.
  const step = (delta: number) => setWeight(((weight === '' ? previous?.weightKg ?? 80 : value) + delta).toFixed(2))
  const [locking, setLocking] = useState(false)
  // Blink the reading like a scale settling before it saves.
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid || locking) return
    setLocking(true)
    setTimeout(() => void onSave(value).catch(() => undefined).finally(() => setLocking(false)), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900)
  }
  return <form className={`weight-today${locking ? ' is-locking' : ''}`} onSubmit={submit}>
    <div className="weight-today__glow" aria-hidden="true" />
    <div className="weight-today__body">
    <div className="weight-today__title">
      <span className="finance-eyebrow">{new Date(`${today}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
      <h2>Morning weigh-in</h2>
    </div>
    <div className="weight-scale">
      <label className="weight-scale__display">
        <input type="number" inputMode="decimal" required min="20" max="400" step="0.05" aria-label="Today's weight in kg" placeholder={previous ? previous.weightKg.toFixed(2) : '00.00'} value={weight} onChange={e => setWeight(e.target.value)} autoFocus />
        <span className="weight-scale__unit">kg</span>
      </label>
      <div className="weight-scale__buttons">
        <button type="button" aria-label="Decrease by 0.05 kg" onClick={() => step(-0.05)}>−</button>
        <button type="button" aria-label="Increase by 0.05 kg" onClick={() => step(0.05)}>+</button>
      </div>
      <div className="weight-scale__feet" aria-hidden="true"><i /><i /></div>
    </div>
    <div className="weight-today__side">
      <dl className="weight-today__compare" aria-live="polite">
        {previous && <div><dt>{valid ? 'vs' : 'Last'} · {shortDate(previous.date)}</dt><dd>{valid ? <span className={value - previous.weightKg <= 0 ? 'weight-stat--good' : 'weight-stat--bad'}>{signed(value - previous.weightKg)} kg</span> : kg(previous.weightKg)}</dd></div>}
        {goal && <div><dt>{valid ? 'vs goal today' : 'Goal today'}</dt><dd>{valid ? <span className={value - goal.weightKg <= 0 ? 'weight-stat--good' : 'weight-stat--bad'}>{signed(value - goal.weightKg)} kg</span> : kg(goal.weightKg)}</dd></div>}
      </dl>
      <button type="submit" className="finance-primary weight-today__submit" disabled={!valid || locking}>{locking ? 'Reading…' : 'Log weight ↵'}</button>
      {streak > 0 && <small className="weight-today__streak"><span aria-hidden="true">{Array.from({ length: Math.min(streak, 7) }, (_, i) => <i key={i} />)}</span>{streak}-day streak, keep it going</small>}
    </div>
    </div>
  </form>
}

function Log({ entries, goals, days, onOpen, onImport, onDelete }: { entries: WeightEntry[]; goals: WeightGoal[]; days: FoodDay[]; onOpen: (date: string) => void; onImport: (rows: WeightEntry[]) => Promise<unknown>; onDelete: (date: string) => Promise<unknown> }) {
  const [paste, setPaste] = useState(''), [selectedDate, setSelectedDate] = useState(localToday())
  const trend = movingAverage(entries)
  const averages = new Map(entries.map((entry, index) => [entry.date, trend[index]]))
  const dates = [...new Set([...entries.map(entry => entry.date), ...days.map(day => day.date)])].sort().reverse()
  const targets = new Map(goalReference(goals, dates[0] ?? localToday()).map(point => [point.date, point.weightKg]))
  const parsed = parseSheetRows(paste)
  return <>
    <form className="weight-history__open" onSubmit={event => { event.preventDefault(); onOpen(selectedDate) }}><label className="finance-field">Open a day<input type="date" required max={localToday()} value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /></label><button type="submit">Open day</button></form>
    {!entries.length && <><p className="finance-muted">Copy your DATE and WEIGHT columns from a spreadsheet to import.</p><textarea className="weight-paste" rows={4} value={paste} onChange={event => setPaste(event.target.value)} placeholder={'14/10/2026\t81\n15/10/2026\t80,55'} /><button type="button" disabled={!parsed.length} onClick={() => void onImport(parsed).then(() => setPaste('')).catch(() => undefined)}>Import {parsed.length || ''} entries</button></>}
    <div className="weight-history__scroll"><table className="weight-table"><thead><tr><th>Date</th><th>Weight</th><th>7-day avg</th><th>Target</th><th>Vs target</th><th>Eaten</th><th /></tr></thead><tbody>{dates.map(date => {
      const entry = entries.find(value => value.date === date), avg = averages.get(date), target = targets.get(date), food = days.find(value => value.date === date)
      return <tr key={date}><td><button type="button" className="weight-history__date" aria-label={`Open ${date}`} onClick={() => onOpen(date)}>{shortDate(date)}</button></td><td>{entry?.weightKg.toFixed(2) ?? '—'}</td><td>{avg?.toFixed(2) ?? '—'}</td><td>{target?.toFixed(2) ?? '—'}</td><td className={avg !== undefined && target !== undefined ? avg <= target ? 'weight-stat--good' : 'weight-stat--bad' : undefined}>{avg !== undefined && target !== undefined ? signed(avg - target) : '—'}</td><td><button type="button" className="weight-history__food" aria-label={`Food for ${date}`} onClick={() => onOpen(date)}>{food?.kcal === null || food?.kcal === undefined ? '—' : `${food.kcal} kcal`}{food && <small>{food.confirmedRevision === food.revision ? 'Reviewed' : 'Unreviewed'}</small>}</button></td><td>{entry && <button type="button" className="finance-remove" aria-label={`Delete ${date}`} onClick={() => { if (window.confirm(`Delete ${shortDate(date)}?`)) void onDelete(date).catch(() => undefined) }}>×</button>}</td></tr>
    })}</tbody></table></div>
  </>
}

// Collapsed by default: logs and settings stay out of the way of the daily view.
function Drawer({ title, meta, open, children }: { title: string; meta: ReactNode; open?: boolean; children: ReactNode }) {
  return <details className="finance-card weight-drawer" open={open}>
    <summary><span className="finance-eyebrow">{title}</span><span className="weight-drawer__meta">{meta}</span></summary>
    <div className="weight-drawer__body">{children}</div>
  </details>
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

function Phases({ phases, bodyKg, defaultStart, onSave, onDelete }: { phases: Phase[]; bodyKg?: number; defaultStart: string; onSave: (phase: Phase) => Promise<unknown>; onDelete: (date: string) => Promise<unknown> }) {
  const today = localToday()
  const current = phaseOn(phases, today) ?? phases[0]
  const [saveError, setSaveError] = useState(''), [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [startDate, setStartDate] = useState(phases.length ? today : defaultStart)
  const [maintenance, setMaintenance] = useState(current ? String(current.maintenanceKcal) : '')
  const [intake, setIntake] = useState(current ? String(current.intakeKcal) : '')
  const [protein, setProtein] = useState(String(current?.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG))
  const perWeek = (phase: Phase) => (phase.maintenanceKcal - phase.intakeKcal) * 7 / KCAL_PER_KG
  const edit = (phase: Phase) => { setStartDate(phase.startDate); setMaintenance(String(phase.maintenanceKcal)); setIntake(String(phase.intakeKcal)); setProtein(String(phase.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG)); setEditing(true) }
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setSaveError(''); try { await onSave({ startDate, maintenanceKcal: Number(maintenance), intakeKcal: Number(intake), proteinPerKg: Number(protein) }); setEditing(false) } catch { setSaveError('Could not save this phase. Your draft is still here.') } finally { setSaving(false) } }
  const perKg = current?.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG
  const draft = { startDate, maintenanceKcal: Number(maintenance), intakeKcal: Number(intake) }
  const draftValid = maintenance !== '' && intake !== '' && draft.maintenanceKcal >= 500
  return <article className="finance-card weight-plan">
    <div className="finance-card-heading"><span className="finance-eyebrow">KCAL PLAN</span>
      {!editing && <button type="button" onClick={() => { setStartDate(today); setEditing(true) }}>+ New phase</button>}</div>
    {current && !editing && <div className="weight-plan__now">
      <small>{current.startDate <= today ? 'Now' : 'Starts'} · since {shortDate(current.startDate)}</small>
      <EnergyBar maintenance={current.maintenanceKcal} intake={current.intakeKcal} />
      <dl className="weight-plan__figures">
        <div><dt>Per day</dt><dd className={perWeek(current) >= 0 ? 'weight-stat--good' : 'weight-stat--bad'}>{signed(current.intakeKcal - current.maintenanceKcal, 0)} <small>kcal</small></dd></div>
        <div><dt>Per week</dt><dd className={perWeek(current) >= 0 ? 'weight-stat--good' : 'weight-stat--bad'}>{signed(-perWeek(current))} <small>kg</small></dd></div>
        <div><dt>1 kg takes</dt><dd>{perWeek(current) > 0 ? Math.round(7 / perWeek(current)) : '∞'} <small>days</small></dd></div>
        <div title={`${perKg} g per kg of body weight`}><dt>Protein</dt><dd>{bodyKg ? Math.round(perKg * bodyKg) : '—'} <small>g / day</small></dd></div>
      </dl>
    </div>}
    {editing && <form className="weight-plan__form" onSubmit={submit}><fieldset disabled={saving} className="weight-form">
      {!phases.length && <p className="finance-muted">Set a manual daily burn and intake, or use Recalculate above for your target weight and date.</p>}
      <div className="finance-fields">
        <label className="finance-field">From<input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label className="finance-field">Burn (maintenance)<input type="number" required min="500" max="10000" step="1" placeholder="2300" value={maintenance} onChange={e => setMaintenance(e.target.value)} /></label>
        <label className="finance-field">Eat (intake)<input type="number" required min="0" max="10000" step="1" placeholder="1800" value={intake} onChange={e => setIntake(e.target.value)} /></label>
        <label className="finance-field">Protein (g per kg)<input type="number" required min="0.5" max="4" step="0.1" value={protein} onChange={e => setProtein(e.target.value)} /></label>
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
  </article>
}

const BOT = 'focustixer_bot'
type TelegramState = { linked: false } | { linked: true; timeZone: string; remindHour: number }
const hours = Array.from({ length: 24 }, (_, hour) => hour)
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

function TelegramCard() {
  const [state, setState] = useState<TelegramState | null>(null)
  const [code, setCode] = useState('')
  const [hour, setHour] = useState(8)
  const [error, setError] = useState('')
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  useEffect(() => { void get<TelegramState>('/telegram').then(setState, () => setError('Could not load Telegram settings.')) }, [])
  const connect = (event: FormEvent) => {
    event.preventDefault(); setError('')
    void post<object, TelegramState>('/telegram/link', { code, timeZone, remindHour: hour }).then(setState, failure =>
      setError(failure instanceof ApiError && failure.status === 404 ? 'That code didn’t work. Send /start to the bot for a new one.' : 'Could not connect. Try again.'))
  }
  const setReminder = (remindHour: number) => void put<object, TelegramState>('/telegram', { timeZone, remindHour }).then(setState, () => setError('Could not save the reminder time.'))
  const disconnect = () => { if (window.confirm('Stop Telegram reminders and unlink this chat?')) void del('/telegram').then(() => setState({ linked: false }), () => setError('Could not disconnect.')) }
  if (!state) return error ? <p role="alert" className="finance-notice">{error}</p> : null
  return <Drawer title="TELEGRAM" meta={state.linked ? <span className="weight-telegram__status">● Connected · {hourLabel(state.remindHour)}</span> : 'Not connected'}>
    {state.linked ? <div className="weight-telegram weight-telegram--linked">
    <svg className="weight-telegram__icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.4 3.2 2.9 10.4c-1.2.5-1.2 1.6 0 2l4.6 1.4 1.8 5.5c.2.7 1 .9 1.5.4l2.6-2.4 4.9 3.6c.8.5 1.6.2 1.8-.8l3-14.3c.3-1.3-.5-1.9-1.7-1.6Zm-11.2 11.5-.4 3.7-1.5-4.6L18 7.3Z" /></svg>
    <span>Daily reminder from <a href={`https://t.me/${BOT}`} target="_blank" rel="noreferrer">@{BOT}</a> at</span>
    <select className="weight-telegram__hour" aria-label="Reminder time" title={state.timeZone} value={state.remindHour} onChange={e => setReminder(Number(e.target.value))}>{hours.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
    <button type="button" className="weight-telegram__disconnect" onClick={disconnect}>Disconnect</button>
    </div> : <form className="weight-telegram" onSubmit={connect}>
      <ol className="weight-telegram__steps">
        <li>Open <a href={`https://t.me/${BOT}`} target="_blank" rel="noreferrer">@{BOT}</a> and press <strong>Start</strong>.</li>
        <li>Enter the code it sends you. Each day it’ll ask for your weight; reply with the number to log it. Send meals as text or photos to log food.</li>
      </ol>
      <div className="finance-fields">
        <label className="finance-field">Code<input required value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABC234" maxLength={6} autoComplete="off" spellCheck={false} className="weight-telegram__code" /></label>
        <label className="finance-field">Remind me at<select value={hour} onChange={e => setHour(Number(e.target.value))}>{hours.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
        <button type="submit" className="finance-primary" disabled={code.length < 6}>Connect</button>
      </div>
    </form>}
    {error && <p role="alert" className="finance-danger">{error}</p>}
  </Drawer>
}
