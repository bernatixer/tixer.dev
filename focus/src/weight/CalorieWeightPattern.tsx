import { useState } from 'react'
import { calorieWeightPattern, CALORIE_PATTERN_THRESHOLD, localToday, mealDay, type FoodDay, type WeightEntry } from './model'
import { compactWeightDate, formatWeightDate } from './format'

const change = (value: number) => {
  const rounded = Number(value.toFixed(2))
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${Math.abs(rounded).toFixed(2)}`
}

export function CalorieWeightPattern({ entries, days }: { entries: WeightEntry[]; days: FoodDay[] }) {
  const [lag, setLag] = useState<1 | 3 | 7>(1)
  const [selected, setSelected] = useState<string | null>(null)
  const { points, low, high, skippedDays } = calorieWeightPattern(entries, days, lag, localToday(), mealDay())
  const threshold = CALORIE_PATTERN_THRESHOLD.toLocaleString('en-US')
  const windowLabel = lag === 1 ? 'next morning' : `${lag} days later`
  const kcalMax = Math.max(4000, Math.ceil(Math.max(...points.map(point => point.kcal), 0) / 500) * 500)
  const kgMax = Math.max(0.25, Math.ceil(Math.max(...points.map(point => Math.abs(point.changeKg)), 0) * 4) / 4)
  const x = (kcal: number) => kcal / kcalMax * 100
  const y = (kg: number) => (kgMax - kg) / (kgMax * 2) * 100
  const current = points.find(point => point.date === selected)
  const groups = [{ label: `Below ${threshold} kcal`, summary: low, high: false }, { label: `${threshold}+ kcal`, summary: high, high: true }]
  return <section className="finance-card weight-pattern" aria-label="Calories and weight pattern">
    <div className="finance-card-heading weight-pattern__heading">
      <div><h2 className="finance-eyebrow">CALORIES &amp; WEIGHT</h2><small className="finance-muted">All logged history</small></div>
      <div className="weight-chart__controls" role="group" aria-label="Weight change window">
        {([1, 3, 7] as const).map(value => <button key={value} type="button" aria-pressed={lag === value} onClick={() => { setLag(value); setSelected(null) }}>{value === 1 ? 'Next morning' : `${value} days later`}</button>)}
      </div>
    </div>
    <p className="weight-pattern__intro">Logged calories vs. scale change {windowLabel}.</p>
    <div className="weight-pattern__groups">
      {groups.map(({ label, summary, high }) => <div key={label} className={`weight-pattern__group${high ? ' weight-pattern__group--high' : ''}`}>
        <span>{label}</span><strong>{summary.meanChangeKg === null ? '—' : `${change(summary.meanChangeKg)} kg`}</strong>
        <small>{summary.count} matched {summary.count === 1 ? 'day' : 'days'} · average change</small>
      </div>)}
    </div>
    {points.length > 0 ? <>
      <div className="weight-pattern__axis-title">Scale change · kg</div>
      <div className="weight-pattern__plot" role="group" aria-label={`Daily calories versus weight change ${windowLabel}`}>
        <div className="weight-pattern__high-zone" style={{ left: `${x(CALORIE_PATTERN_THRESHOLD)}%` }} aria-hidden="true" />
        {[kgMax, kgMax / 2, 0, -kgMax / 2, -kgMax].map(value => <div key={value} className={`weight-pattern__grid${value === 0 ? ' weight-pattern__grid--zero' : ''}`} style={{ top: `${y(value)}%` }} aria-hidden="true"><span>{change(value)}</span></div>)}
        <div className="weight-pattern__threshold" style={{ left: `${x(CALORIE_PATTERN_THRESHOLD)}%` }} aria-hidden="true"><span>{threshold}+</span></div>
        {points.map(point => <button key={point.date} type="button" className={`weight-pattern__dot${point.kcal >= CALORIE_PATTERN_THRESHOLD ? ' weight-pattern__dot--high' : ''}`}
          style={{ left: `${x(point.kcal)}%`, top: `${y(point.changeKg)}%` }}
          aria-label={`${formatWeightDate(point.date)}: ${point.kcal} kcal, ${change(point.changeKg)} kg ${windowLabel}`} aria-pressed={selected === point.date}
          onFocus={() => setSelected(point.date)} onClick={() => setSelected(point.date)}><span aria-hidden="true" /></button>)}
      </div>
      <div className="weight-pattern__x-labels" aria-hidden="true"><span>0</span><span>{(kcalMax / 2).toLocaleString('en-US')}</span><span>{kcalMax.toLocaleString('en-US')}</span></div>
      <div className="weight-pattern__x-title">Logged that day · kcal</div>
      <div className="weight-pattern__detail" aria-live="polite">
        {current ? <><time>{compactWeightDate(current.date)}</time><span>{current.kcal.toLocaleString('en-US')} kcal</span><strong>{change(current.changeKg)} kg</strong><span>by {compactWeightDate(current.endDate)}</span></> : <span>Each dot is one food day; dots can overlap. Select one for its values.</span>}
      </div>
    </> : <div className="weight-pattern__empty"><strong>No matched days yet.</strong><span>Log food and a weigh-in on that day, plus a weigh-in {windowLabel}, to see the pattern.</span></div>}
    <small className="weight-pattern__note">Completed food days with both weigh-ins only.{skippedDays > 0 && ` ${skippedDays} logged ${skippedDays === 1 ? 'day is' : 'days are'} missing a matching weigh-in.`} Partial food logs can skew the comparison.</small>
    <small className="weight-pattern__note">Association, not a measure of fat gained. Water, later meals and activity also affect the scale. <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5506524/" target="_blank" rel="noreferrer">About short-term weight changes ↗</a></small>
  </section>
}
