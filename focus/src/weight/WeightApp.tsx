import { useCallback, useEffect, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { useAuth, SignIn, UserButton } from '@clerk/clerk-react'
import { AppHeader } from '@/components/AppHeader'
import { useAuthSync } from '@/hooks/useAuthSync'
import { del, get, put } from '@/api/client'
import { analyse, dateOf, last, phaseOn, streakBefore, dayNumber, goalLine, KCAL_PER_KG, localToday, movingAverage, parseSheetRows, type Phase, type WeightEntry } from './model'
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
  const [data, setData] = useState<{ entries: WeightEntry[]; phases: Phase[] } | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => get<{ entries: WeightEntry[]; phases: Phase[] }>('/weight').then(setData, () => setError('Could not load your weight log.')), [])
  useEffect(() => { void load() }, [load])
  const run = (action: Promise<unknown>) => { setError(''); return action.then(load, () => setError('Could not save. Try again.')) }

  if (!data) return error ? <p role="alert" className="finance-notice">{error}</p> : <p className="finance-loading">Loading…</p>
  const { entries, phases } = data
  return <>
    {error && <p role="alert" className="finance-notice">{error}</p>}
    {!entries.some(entry => entry.date === localToday()) && <TodayForm entries={entries} phases={phases} onSave={weightKg => run(put(`/weight/entries/${localToday()}`, { weightKg }))} />}
    <Stats entries={entries} phases={phases} />
    {entries.length > 0 && <Chart entries={entries} phases={phases} />}
    <div className="weight-columns">
      <Log entries={entries} phases={phases}
        onImport={rows => run(Promise.all(rows.map(entry => put(`/weight/entries/${entry.date}`, { weightKg: entry.weightKg }))))}
        onDelete={date => run(del(`/weight/entries/${date}`))} />
      <Phases phases={phases} defaultStart={entries[0]?.date ?? localToday()} onSave={phase => run(put(`/weight/phases/${phase.startDate}`, { maintenanceKcal: phase.maintenanceKcal, intakeKcal: phase.intakeKcal }))}
        onDelete={date => run(del(`/weight/phases/${date}`))} />
    </div>
  </>
}

function Stats({ entries, phases }: { entries: WeightEntry[]; phases: Phase[] }) {
  const result = analyse(entries, phases)
  if (!result) return null
  const current = phaseOn(phases, last(entries)!.date)
  const tiles: [string, string, string, string?][] = [
    ['7-day average', kg(result.trendKg), `Last weigh-in ${kg(last(entries)!.weightKg)}`],
    ['Since start', `${signed(result.changeKg)} kg`, `From ${kg(entries[0].weightKg)} on ${shortDate(entries[0].date)}`, result.changeKg <= 0 ? 'good' : 'bad'],
    ['Vs goal', result.vsGoalKg === null ? '—' : `${signed(result.vsGoalKg)} kg`, result.vsGoalKg === null ? 'Add a kcal phase' : result.vsGoalKg <= 0 ? 'Ahead of plan' : 'Behind plan', result.vsGoalKg === null ? undefined : result.vsGoalKg <= 0 ? 'good' : 'bad'],
    ['Pace / week', result.kgPerWeek === null ? '—' : `${signed(result.kgPerWeek)} kg`, result.kgPerWeek === null ? 'Needs a week of data' : result.plannedKgPerWeek === null ? 'Actual, last 3 weeks' : `Planned ${signed(result.plannedKgPerWeek)} kg`],
    ['Real maintenance', result.maintenanceKcal === null ? '—' : `${result.maintenanceKcal} kcal`, result.maintenanceKcal === null ? 'Needs two weeks of data' : current ? `You set ${current.maintenanceKcal} kcal` : 'Estimated from your trend'],
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
    <span className="finance-eyebrow">{new Date(`${today}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
    <h2>Morning weigh-in</h2>
    <div className="weight-scale">
      <label className="weight-scale__display">
        <span className="weight-scale__reading">
          <span className="weight-scale__ghost" aria-hidden="true">{(88.88).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <input type="number" inputMode="decimal" required min="20" max="400" step="0.05" aria-label="Today's weight in kg" placeholder={previous ? previous.weightKg.toFixed(2) : '00.00'} value={weight} onChange={e => setWeight(e.target.value)} autoFocus />
        </span>
        <span className="weight-scale__unit">kg</span>
      </label>
      <div className="weight-scale__buttons">
        <button type="button" aria-label="Decrease by 0.05 kg" onClick={() => step(-0.05)}>−</button>
        <button type="button" aria-label="Increase by 0.05 kg" onClick={() => step(0.05)}>+</button>
      </div>
      <div className="weight-scale__feet" aria-hidden="true"><i /><i /></div>
    </div>
    <p className="weight-today__compare" aria-live="polite">
      {previous && <span>{valid ? <strong className={value - previous.weightKg <= 0 ? 'weight-stat--good' : 'weight-stat--bad'}>{signed(value - previous.weightKg)} kg</strong> : <strong>{kg(previous.weightKg)}</strong>} {valid ? 'vs' : 'on'} {shortDate(previous.date)}</span>}
      {goal && <span>{valid ? <strong className={value - goal.weightKg <= 0 ? 'weight-stat--good' : 'weight-stat--bad'}>{signed(value - goal.weightKg)} kg</strong> : <strong>{kg(goal.weightKg)}</strong>} {valid ? 'vs goal' : 'goal today'}</span>}
    </p>
    <button type="submit" className="finance-primary weight-today__submit" disabled={!valid || locking}>{locking ? 'Reading…' : 'Log weight ↵'}</button>
    {streak > 0 && <small className="weight-today__streak"><span aria-hidden="true">{Array.from({ length: Math.min(streak, 7) }, (_, i) => <i key={i} />)}</span>{streak}-day streak, keep it going</small>}
  </form>
}

function Log({ entries, phases, onImport, onDelete }: { entries: WeightEntry[]; phases: Phase[]; onImport: (rows: WeightEntry[]) => Promise<unknown>; onDelete: (date: string) => Promise<unknown> }) {
  const [paste, setPaste] = useState('')
  const trend = movingAverage(entries)
  const goal = new Map(goalLine(entries, phases, last(entries)?.date ?? localToday()).map(point => [point.date, point.weightKg]))
  const parsed = parseSheetRows(paste)
  return <article className="finance-card">
    <span className="finance-eyebrow">HISTORY</span>
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
  </article>
}

function Phases({ phases, defaultStart, onSave, onDelete }: { phases: Phase[]; defaultStart: string; onSave: (phase: Phase) => Promise<unknown>; onDelete: (date: string) => Promise<unknown> }) {
  const previous = last(phases)
  const [startDate, setStartDate] = useState(previous ? localToday() : defaultStart)
  const [maintenance, setMaintenance] = useState(previous ? String(previous.maintenanceKcal) : '')
  const [intake, setIntake] = useState(previous ? String(previous.intakeKcal) : '')
  const submit = (event: FormEvent) => { event.preventDefault(); void onSave({ startDate, maintenanceKcal: Number(maintenance), intakeKcal: Number(intake) }) }
  const perWeek = (phase: Phase) => (phase.maintenanceKcal - phase.intakeKcal) * 7 / KCAL_PER_KG
  return <article className="finance-card">
    <span className="finance-eyebrow">KCAL PLAN</span>
    <p className="finance-muted">Each phase runs until the next one starts. The goal line drops by the daily deficit ÷ {KCAL_PER_KG} kcal per kg.</p>
    {phases.length > 0 && <table className="weight-table">
      <thead><tr><th>From</th><th>Maintenance</th><th>Intake</th><th>Deficit / day</th><th>Expected / week</th><th /></tr></thead>
      <tbody>{[...phases].reverse().map(phase => <tr key={phase.startDate}>
        <td>{shortDate(phase.startDate)}</td><td>{phase.maintenanceKcal}</td><td>{phase.intakeKcal}</td><td>{phase.maintenanceKcal - phase.intakeKcal}</td><td>{signed(-perWeek(phase))} kg</td>
        <td><button type="button" className="finance-remove" aria-label={`Delete phase from ${phase.startDate}`} onClick={() => { if (window.confirm(`Delete the phase starting ${shortDate(phase.startDate)}?`)) void onDelete(phase.startDate) }}>×</button></td>
      </tr>)}</tbody>
    </table>}
    <form className="finance-fields" onSubmit={submit}>
      <label className="finance-field">From<input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
      <label className="finance-field">Maintenance (kcal)<input type="number" required min="500" max="10000" step="1" placeholder="2300" value={maintenance} onChange={e => setMaintenance(e.target.value)} /></label>
      <label className="finance-field">Intake (kcal)<input type="number" required min="0" max="10000" step="1" placeholder="1800" value={intake} onChange={e => setIntake(e.target.value)} /></label>
      <button type="submit" className="finance-primary">{phases.some(phase => phase.startDate === startDate) ? 'Update phase' : 'Add phase'}</button>
    </form>
  </article>
}
