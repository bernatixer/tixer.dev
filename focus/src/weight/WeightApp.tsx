import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { useAuth, SignIn, UserButton } from '@clerk/clerk-react'
import { AppHeader } from '@/components/AppHeader'
import { useAuthSync } from '@/hooks/useAuthSync'
import { ApiError, del, get, post, put } from '@/api/client'
import { analyse, dateOf, DEFAULT_PROTEIN_PER_KG, last, loggedDayTotals, mealDay, phaseOn, streakBefore, type Meal, dayNumber, goalLine, KCAL_PER_KG, localToday, movingAverage, parseSheetRows, type Phase, type WeightEntry } from './model'
import '@/finance/finance.css'
import './weight.css'

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
  const load = useCallback(() => get<WeightData>('/weight').then(setData, () => setError('Could not load your weight log.')), [])
  useEffect(() => { void load() }, [load])
  const run = (action: Promise<unknown>) => { setError(''); return action.then(load, () => setError('Could not save. Try again.')) }

  if (!data) return error ? <p role="alert" className="finance-notice">{error}</p> : <p className="finance-loading">Loading…</p>
  const { entries, phases, meals } = data
  const foodDay = mealDay()
  const eaten = loggedDayTotals(meals, phases, foodDay)
  const bodyKg = entries.length ? last(movingAverage(entries)) : undefined
  return <>
    {error && <p role="alert" className="finance-notice">{error}</p>}
    {!entries.some(entry => entry.date === localToday()) && <TodayForm entries={entries} phases={phases} onSave={weightKg => run(put(`/weight/entries/${localToday()}`, { weightKg }))} />}
    <Stats entries={entries} phases={phases} eaten={eaten} />
    {entries.length > 0 && <Chart entries={entries} phases={phases} />}
    <div className="weight-columns">
      <Food meals={meals.filter(meal => meal.date === foodDay)} phase={phaseOn(phases, foodDay)} bodyKg={bodyKg}
        onAdd={(text, image) => post<object, Meal>('/meals', { text, image, date: foodDay, language: navigator.language }).then(load)}
        onUpdate={(id, kcal) => run(put(`/meals/${id}`, { kcal }))} onDelete={id => run(del(`/meals/${id}`))} />
      <Phases phases={phases} bodyKg={bodyKg} defaultStart={entries[0]?.date ?? localToday()} onSave={phase => run(put(`/weight/phases/${phase.startDate}`, { maintenanceKcal: phase.maintenanceKcal, intakeKcal: phase.intakeKcal, proteinPerKg: phase.proteinPerKg }))}
        onDelete={date => run(del(`/weight/phases/${date}`))} />
    </div>
    <Drawer title="HISTORY" meta={entries.length ? `${entries.length} weigh-in${entries.length === 1 ? '' : 's'}` : 'Import from a spreadsheet'} open={!entries.length}>
      <Log entries={entries} phases={phases}
        onImport={rows => run(Promise.all(rows.map(entry => put(`/weight/entries/${entry.date}`, { weightKg: entry.weightKg }))))}
        onDelete={date => run(del(`/weight/entries/${date}`))} />
    </Drawer>
    <TelegramCard />
  </>
}

type WeightData = { entries: WeightEntry[]; phases: Phase[]; meals: Meal[] }

function Stats({ entries, phases, eaten }: { entries: WeightEntry[]; phases: Phase[]; eaten: Map<string, number> }) {
  const result = analyse(entries, phases, 21, eaten)
  if (!result) return null
  const current = phaseOn(phases, last(entries)!.date)
  const tiles: [string, string, string, string?][] = [
    ['7-day average', kg(result.trendKg), `Last weigh-in ${kg(last(entries)!.weightKg)}`],
    ['Since start', `${signed(result.changeKg)} kg`, `From ${kg(entries[0].weightKg)} on ${shortDate(entries[0].date)}`, result.changeKg <= 0 ? 'good' : 'bad'],
    ['Vs goal', result.vsGoalKg === null ? '—' : `${signed(result.vsGoalKg)} kg`, result.vsGoalKg === null ? 'Add a kcal phase' : result.vsGoalKg <= 0 ? 'Ahead of plan' : 'Behind plan', result.vsGoalKg === null ? undefined : result.vsGoalKg <= 0 ? 'good' : 'bad'],
    ['Pace / week', result.kgPerWeek === null ? '—' : `${signed(result.kgPerWeek)} kg`, result.kgPerWeek === null ? 'Needs a week of data' : result.plannedKgPerWeek === null ? 'Actual, last 3 weeks' : `Planned ${signed(result.plannedKgPerWeek)} kg`],
    ['Real maintenance', result.maintenanceKcal === null ? '—' : `${result.maintenanceKcal} kcal`, result.maintenanceKcal === null ? 'Needs two weeks of data' : `${result.loggedDays ? `${result.loggedDays} logged days` : 'From your plan'}${current ? ` · you set ${current.maintenanceKcal}` : ''}`],
  ]
  return <section className="weight-stats">{tiles.map(([label, value, note, tone]) => <div key={label} className="finance-card weight-stat">
    <span className="finance-eyebrow">{label}</span><strong className={tone ? `weight-stat--${tone}` : undefined}>{value}</strong><small>{note}</small>
  </div>)}</section>
}

function Chart({ entries, phases }: { entries: WeightEntry[]; phases: Phase[] }) {
  const trend = movingAverage(entries)
  const end = dateOf(Math.max(dayNumber(last(entries)!.date), dayNumber(localToday())) + 14)
  const goal = phases.length ? goalLine(entries, phases, end) : []
  const values = [...entries.map(entry => entry.weightKg), ...goal.map(point => point.weightKg)]
  const top = Math.ceil(Math.max(...values) * 2 + 1) / 2, bottom = Math.floor(Math.min(...values) * 2 - 1) / 2
  const startDay = dayNumber(entries[0].date), days = dayNumber(end) - startDay
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
      <div className="weight-chart__legend"><span><i className="weight-key--raw" />Weigh-ins</span><span><i className="weight-key--trend" />7-day average</span>{goal.length > 0 && <span><i className="weight-key--goal" />Goal</span>}</div></div>
    <div className="weight-chart__plot" onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
      <div className="weight-chart__scale">{ticks.map(tick => <span key={tick} style={{ top: `${(top - tick) / (top - bottom) * 100}%` }}>{tick.toFixed(1)}</span>)}</div>
      {/* Stretched to fit; non-scaling strokes and zero-length round caps keep lines and dots crisp. */}
      <svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="img" aria-label="Weight, 7-day average and goal over time">
        {ticks.map(tick => <line key={tick} className="weight-chart__grid" x1="0" x2="1000" y1={y(tick)} y2={y(tick)} />)}
        <line className="weight-chart__today" x1={x(localToday())} x2={x(localToday())} y1="0" y2="300" />
        {goal.length > 0 && <path className="weight-chart__goal" d={path(goal.map(point => [point.date, point.weightKg]))} />}
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

function TodayForm({ entries, phases, onSave }: { entries: WeightEntry[]; phases: Phase[]; onSave: (weightKg: number) => Promise<unknown> }) {
  const today = localToday()
  const previous = last(entries)
  const [weight, setWeight] = useState('')
  const value = Number(weight)
  const valid = weight !== '' && value >= 20 && value <= 400
  const goal = phases.length ? last(goalLine(entries, phases, today)) : undefined
  const streak = streakBefore(entries, today)
  // Steppers start from the last weigh-in so a typical day is a couple of taps.
  const step = (delta: number) => setWeight(((weight === '' ? previous?.weightKg ?? 80 : value) + delta).toFixed(2))
  const [locking, setLocking] = useState(false)
  // Blink the reading like a scale settling before it saves.
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid || locking) return
    setLocking(true)
    setTimeout(() => void onSave(value).finally(() => setLocking(false)), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900)
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

function Log({ entries, phases, onImport, onDelete }: { entries: WeightEntry[]; phases: Phase[]; onImport: (rows: WeightEntry[]) => Promise<unknown>; onDelete: (date: string) => Promise<unknown> }) {
  const [paste, setPaste] = useState('')
  const trend = movingAverage(entries)
  const goal = new Map(goalLine(entries, phases, last(entries)?.date ?? localToday()).map(point => [point.date, point.weightKg]))
  const parsed = parseSheetRows(paste)
  return <>
    {!entries.length && <>
      <p className="finance-muted">Starting from a spreadsheet? Copy the DATE and WEIGHT columns and paste them here.</p>
      <textarea className="weight-paste" rows={4} value={paste} onChange={e => setPaste(e.target.value)} placeholder={'14/10/2026\t81\n15/10/2026\t80,55'} />
      <button type="button" disabled={!parsed.length} onClick={() => void onImport(parsed).then(() => setPaste(''))}>Import {parsed.length || ''} {parsed.length === 1 ? 'entry' : 'entries'}</button>
    </>}
    {entries.length > 0 && <table className="weight-table">
      <thead><tr><th>Date</th><th>Weight</th><th>7-day avg</th><th>Goal</th><th>Vs goal</th><th /></tr></thead>
      <tbody>{entries.map((entry, i) => ({ entry, avg: trend[i], target: goal.get(entry.date) })).reverse().map(({ entry, avg, target }) => <tr key={entry.date}>
        <td>{shortDate(entry.date)}</td><td>{entry.weightKg.toFixed(2)}</td><td>{avg.toFixed(2)}</td><td>{phases.length && target !== undefined ? target.toFixed(2) : '—'}</td>
        <td className={phases.length && target !== undefined ? avg - target <= 0 ? 'weight-stat--good' : 'weight-stat--bad' : undefined}>{phases.length && target !== undefined ? signed(avg - target) : '—'}</td>
        <td><button type="button" className="finance-remove" aria-label={`Delete ${entry.date}`} onClick={() => { if (window.confirm(`Delete ${shortDate(entry.date)}?`)) void onDelete(entry.date) }}>×</button></td>
      </tr>)}</tbody>
    </table>}
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
  const [editing, setEditing] = useState(!phases.length)
  const [startDate, setStartDate] = useState(phases.length ? today : defaultStart)
  const [maintenance, setMaintenance] = useState(current ? String(current.maintenanceKcal) : '')
  const [intake, setIntake] = useState(current ? String(current.intakeKcal) : '')
  const [protein, setProtein] = useState(String(current?.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG))
  const perWeek = (phase: Phase) => (phase.maintenanceKcal - phase.intakeKcal) * 7 / KCAL_PER_KG
  const edit = (phase: Phase) => { setStartDate(phase.startDate); setMaintenance(String(phase.maintenanceKcal)); setIntake(String(phase.intakeKcal)); setProtein(String(phase.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG)); setEditing(true) }
  const submit = (event: FormEvent) => { event.preventDefault(); void onSave({ startDate, maintenanceKcal: Number(maintenance), intakeKcal: Number(intake), proteinPerKg: Number(protein) }).then(() => setEditing(false)) }
  const perKg = current?.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG
  const draft = { startDate, maintenanceKcal: Number(maintenance), intakeKcal: Number(intake) }
  const draftValid = maintenance !== '' && intake !== '' && draft.maintenanceKcal >= 500
  return <article className="finance-card weight-plan">
    <div className="finance-card-heading"><span className="finance-eyebrow">KCAL PLAN</span>
      {phases.length > 0 && !editing && <button type="button" onClick={() => { setStartDate(today); setEditing(true) }}>+ New phase</button>}</div>
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
    {editing && <form className="weight-plan__form" onSubmit={submit}>
      {!phases.length && <p className="finance-muted">What you burn and what you plan to eat. The goal line drops by the daily deficit ÷ {KCAL_PER_KG} kcal per kg.</p>}
      <div className="finance-fields">
        <label className="finance-field">From<input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label className="finance-field">Burn (maintenance)<input type="number" required min="500" max="10000" step="1" placeholder="2300" value={maintenance} onChange={e => setMaintenance(e.target.value)} /></label>
        <label className="finance-field">Eat (intake)<input type="number" required min="0" max="10000" step="1" placeholder="1800" value={intake} onChange={e => setIntake(e.target.value)} /></label>
        <label className="finance-field">Protein (g per kg)<input type="number" required min="0.5" max="4" step="0.1" value={protein} onChange={e => setProtein(e.target.value)} /></label>
      </div>
      {draftValid && <><EnergyBar maintenance={draft.maintenanceKcal} intake={draft.intakeKcal} /><p className="weight-plan__preview">{signed(-perWeek(draft))} kg / week</p></>}
      <div className="weight-plan__actions">
        <button type="submit" className="finance-primary">{phases.some(phase => phase.startDate === startDate) ? 'Save phase' : 'Add phase'}</button>
        {phases.length > 0 && <button type="button" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </form>}
    {phases.length > 0 && <ol className="weight-plan__timeline">{[...phases].reverse().map(phase => <li key={phase.startDate} className={phase === current ? 'is-current' : undefined}>
      <button type="button" className="weight-plan__phase" onClick={() => edit(phase)} aria-label={`Edit phase from ${shortDate(phase.startDate)}`}>
        <time>{shortDate(phase.startDate)}</time><span>{phase.intakeKcal} / {phase.maintenanceKcal} kcal</span><strong>{signed(-perWeek(phase))} kg/wk</strong>
      </button>
      <button type="button" className="finance-remove" aria-label={`Delete phase from ${phase.startDate}`} onClick={() => { if (window.confirm(`Delete the phase starting ${shortDate(phase.startDate)}?`)) void onDelete(phase.startDate) }}>×</button>
    </li>)}</ol>}
  </article>
}

// Phone photos are several MB; 1024px JPEG is plenty for estimating a plate.
async function shrinkPhoto(file: File, maxSide = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Eases a number towards its new value so totals tick up instead of jumping.
function useCountUp(target: number, ms = 600) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now(), origin = from.current
    if (origin === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = target; setValue(target); return }
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / ms), eased = 1 - (1 - t) ** 3
      setValue(Math.round(origin + (target - origin) * eased)); from.current = Math.round(origin + (target - origin) * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, ms])
  return value
}

const NUTRIENT_LABELS = [['carbsG', 'Carbs'], ['fatG', 'Fat'], ['saturatedG', 'Sat. fat'], ['fibreG', 'Fibre'], ['sugarG', 'Sugar']] as const

function Food({ meals, phase, bodyKg, onAdd, onUpdate, onDelete }: { meals: Meal[]; phase?: Phase; bodyKg?: number; onAdd: (text: string, image?: string) => Promise<unknown>; onUpdate: (id: string, kcal: number) => Promise<unknown>; onDelete: (id: string) => Promise<unknown> }) {
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<string>()
  const [pending, setPending] = useState<{ text: string; photo?: string }>()
  const [error, setError] = useState('')
  const busy = pending !== undefined
  const total = meals.reduce((sum, meal) => sum + meal.kcal, 0)
  const shownTotal = useCountUp(total)
  const grams = (key: 'proteinG' | (typeof NUTRIENT_LABELS)[number][0]) => Math.round(meals.reduce((sum, meal) => sum + (meal[key] ?? 0), 0))
  const proteinTarget = bodyKg ? Math.round((phase?.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG) * bodyKg) : undefined
  // Meals that weren't in the last list flash for the length of the animation; the first list has nothing to compare against.
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => {
    const added = seen.current ? meals.filter(meal => !seen.current!.has(meal.id)).map(meal => meal.id) : []
    seen.current = new Set(meals.map(meal => meal.id))
    if (!added.length) return
    setFresh(new Set(added))
    const timer = setTimeout(() => setFresh(new Set()), 1400)
    return () => clearTimeout(timer)
  }, [meals])
  const add = (event: FormEvent) => {
    event.preventDefault(); setPending({ text, photo }); setError(''); setText(''); setPhoto(undefined)
    // Restore what was typed if the estimate fails, so nothing has to be re-entered.
    void onAdd(text, photo).catch(failure => { setText(text); setPhoto(photo); throw failure }).catch(failure => setError(failure instanceof ApiError && failure.status === 422 ? 'That doesn’t look like food.' : failure instanceof ApiError && failure.status === 429 ? 'You’ve used today’s meal estimates. More tomorrow.' : 'Couldn’t estimate that right now. Try again in a minute.')).finally(() => setPending(undefined))
  }
  return <article className="finance-card weight-food">
    <span className="finance-eyebrow">FOOD · TODAY</span>
    <div className="weight-food__total"><strong>{shownTotal}</strong> kcal{phase && <small> of {phase.intakeKcal} planned · {total <= phase.intakeKcal ? `${phase.intakeKcal - total} left` : <span className="weight-stat--bad">{total - phase.intakeKcal} over</span>}</small>}</div>
    {phase && <progress className={total > phase.intakeKcal ? 'is-over' : undefined} value={Math.min(total, phase.intakeKcal)} max={phase.intakeKcal} aria-label="Eaten of planned intake" />}
    {meals.some(meal => meal.proteinG != null) && <dl className="weight-food__nutrients">
      <div className="weight-food__protein"><dt>Protein</dt><dd>{grams('proteinG')}<small>{proteinTarget ? ` / ${proteinTarget} g` : ' g'}</small></dd>
        {proteinTarget && <progress value={Math.min(grams('proteinG'), proteinTarget)} max={proteinTarget} aria-label="Protein of target" />}</div>
      {NUTRIENT_LABELS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{grams(key)}<small> g</small></dd></div>)}
    </dl>}
    {(meals.length > 0 || pending) && <ul className="weight-food__meals">{meals.map(meal => <li key={meal.id} className={fresh.has(meal.id) ? 'is-new' : undefined}>
      <time>{new Date(meal.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</time>
      <span>{meal.description}{meal.proteinG != null && <small className="weight-food__macros">{Math.round(meal.proteinG)}P · {Math.round(meal.carbsG ?? 0)}C · {Math.round(meal.fatG ?? 0)}F</small>}</span>
      <label><input type="number" min="0" max="10000" step="1" defaultValue={meal.kcal} aria-label={`kcal for ${meal.description}`}
        onBlur={e => { const kcal = Number(e.target.value); if (Number.isInteger(kcal) && kcal >= 0 && kcal !== meal.kcal) void onUpdate(meal.id, kcal) }} /> kcal</label>
      <button type="button" className="finance-remove" aria-label={`Delete ${meal.description}`} onClick={() => void onDelete(meal.id)}>×</button>
    </li>)}
      {pending && <li className="is-pending" aria-live="polite">
        {pending.photo ? <span className="weight-food__scan"><img src={pending.photo} alt="" /></span> : <time>now</time>}
        <span className="weight-food__thinking">{pending.text || 'Reading your photo'}<i>Estimating</i></span>
        <span className="weight-food__dots" aria-hidden="true"><i /><i /><i /></span>
      </li>}
    </ul>}
    <form className="weight-food__add" onSubmit={add}>
      <label className="weight-food__camera" title="Add a photo">
        {photo ? <img src={photo} alt="Meal photo" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" /></svg>}
        <input type="file" accept="image/*" capture="environment" aria-label="Meal photo" disabled={busy} onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (file) void shrinkPhoto(file).then(setPhoto, () => setError('Couldn’t read that photo.'))
        }} />
      </label>
      {photo && <button type="button" className="finance-remove" aria-label="Remove photo" onClick={() => setPhoto(undefined)}>×</button>}
      <input value={text} onChange={e => setText(e.target.value)} placeholder={photo ? 'Anything to add? e.g. half portion' : 'What did you eat? e.g. 2 eggs, toast and a coffee with milk'} maxLength={500} required={!photo} disabled={busy} />
      <button type="submit" className="finance-primary" disabled={busy || (!text.trim() && !photo)}>{busy ? 'Estimating…' : 'Add'}</button>
    </form>
    {error && <p role="alert" className="finance-danger">{error}</p>}
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
