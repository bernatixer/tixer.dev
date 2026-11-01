import { useId, useState, type PointerEvent } from 'react'
import { CALORIE_PATTERN_THRESHOLD, dateOf, dayNumber, last, localToday, movingAverage, trendAt, type FoodDay, type WeightEntry, type WeightGoal } from './model'
import { goalOn, goalReference, observedTrendForecast } from './goals'
import { compactWeightDate, formatWeightDate } from './format'

type Props = {
  entries: WeightEntry[]; goals: WeightGoal[]; days: FoodDay[]
  onOpenDay: (date: string) => void
}

export function WeightChart({ entries, goals, days: food, onOpenDay }: Props) {
  const [showCalories, setShowCalories] = useState(true), [horizon, setHorizon] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const tooltipId = useId()
  const today = localToday(), currentGoal = goalOn(goals, today)
  const end = dateOf(Math.max(dayNumber(last(entries)!.date), dayNumber(today) + 21, horizon && currentGoal ? dayNumber(currentGoal.targetDate) : 0))
  const first = horizon ? entries[0].date : dateOf(Math.max(dayNumber(entries[0].date), dayNumber(today) - 29))
  const start = dayNumber(first), duration = Math.max(1, dayNumber(end) - start)
  const inView = (date: string) => date >= first && date <= end
  const goal = goalReference(goals, end).filter(point => inView(point.date))
  const predicted = observedTrendForecast(entries, end, today).filter(point => inView(point.date))
  const weights = entries.filter(entry => inView(entry.date)), averages = movingAverage(entries)
  const trend = entries.map((entry, index) => ({ date: entry.date, weightKg: averages[index] })).filter(entry => inView(entry.date))
  const values = [...weights, ...trend, ...goal, ...predicted].map(point => point.weightKg)
  const top = Math.ceil(Math.max(...values, 1) * 2 + 1) / 2, bottom = Math.floor(Math.min(...values, top - 1) * 2 - 1) / 2
  const x = (date: string) => (dayNumber(date) - start) / duration * 1000
  const y = (value: number) => (top - value) / (top - bottom) * 300
  const path = (points: WeightEntry[]) => points.map((point, index) => `${index ? 'L' : 'M'}${x(point.date).toFixed(1)},${y(point.weightKg).toFixed(1)}`).join('')
  const ticks = Array.from({ length: 5 }, (_, index) => top - (top - bottom) * index / 4)
  const logged = food.filter(day => inView(day.date) && day.kcal !== null)
  const highDays = logged.filter(day => day.kcal! >= CALORIE_PATTERN_THRESHOLD)
  const kcalTop = Math.max(1000, Math.ceil(Math.max(...logged.map(day => day.kcal!), 0) / 1000) * 1000)
  const barWidth = Math.min(28, 650 / duration)
  const currentWeight = weights.find(entry => entry.date === hover), currentTrend = hover ? trendAt(entries, hover) : null
  const currentTarget = goal.find(point => point.date === hover), currentFood = food.find(day => day.date === hover)
  const nextDate = hover ? dateOf(dayNumber(hover) + 1) : null
  // boffin: missing next-morning readings stay unknown; a later weigh-in cannot stand in for them.
  const nextWeight = entries.find(entry => entry.date === nextDate && entry.date <= today)
  const overnightChange = currentWeight && nextWeight ? Number((nextWeight.weightKg - currentWeight.weightKg).toFixed(2)) : null
  const changeLabel = overnightChange === null ? '—' : `${overnightChange > 0 ? '+' : overnightChange < 0 ? '−' : '±'}${Math.abs(overnightChange).toFixed(2)} kg`
  const hoverPercent = hover ? (dayNumber(hover) - start) / duration * 100 : 0
  const pointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    setHover(dateOf(start + Math.min(duration, Math.max(0, Math.round((event.clientX - box.left) / box.width * duration)))))
  }
  return <article className="finance-card weight-chart">
    <div className="finance-card-heading"><span className="finance-eyebrow">PROGRESS</span>
      <div className="weight-chart__controls"><div className="weight-chart__range" role="group" aria-label="Chart range"><button type="button" aria-pressed={!horizon} onClick={() => setHorizon(false)}>Recent</button><button type="button" aria-pressed={horizon} onClick={() => setHorizon(true)}>To goal</button></div><button type="button" aria-pressed={showCalories} onClick={() => setShowCalories(value => !value)}>Daily calories</button></div>
    </div>
    <div className="weight-chart__legend"><span><i className="weight-key--raw" />Weigh-ins · kg</span><span><i className="weight-key--trend" />7-day average</span>{goal.length > 0 && <span><i className="weight-key--goal" />Target line</span>}{predicted.length > 0 && <span><i className="weight-key--forecast" />If recent pace continues</span>}{showCalories && <><span><i className="weight-key--calories" />Food logged · kcal</span><span><i className="weight-key--high-calories" />3,000+ kcal days</span></>}</div>
    <div className={`weight-chart__plot${showCalories ? ' weight-chart__plot--calories' : ''}`} onPointerMove={pointer} onPointerLeave={() => setHover(null)}>
      <div className="weight-chart__scale" aria-hidden="true">{ticks.map(tick => <span key={tick} style={{ top: `${(top - tick) / (top - bottom) * 100}%` }}>{tick.toFixed(1)}</span>)}</div>
      {showCalories && <div className="weight-chart__kcal-scale" aria-label="Calories scale"><span>{kcalTop} kcal</span><span>{kcalTop / 2}</span><span>0</span></div>}
      <svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="group" aria-label="Weight and food over time">
        {showCalories && highDays.map(day => <rect key={day.date} className="weight-chart__high-day" x={Math.max(0, x(day.date) - 500 / duration)} y="0" width={Math.min(1000, x(day.date) + 500 / duration) - Math.max(0, x(day.date) - 500 / duration)} height="300" aria-hidden="true" />)}
        {ticks.map(tick => <line key={tick} className="weight-chart__grid" x1="0" x2="1000" y1={y(tick)} y2={y(tick)} />)}
        {showCalories && logged.map(day => <rect key={day.date} className={`weight-chart__calories${day.kcal! >= CALORIE_PATTERN_THRESHOLD ? ' weight-chart__calories--high' : ''}`} x={Math.max(0, Math.min(1000 - barWidth, x(day.date) - barWidth / 2))} y={300 - day.kcal! / kcalTop * 300} width={barWidth} height={Math.max(2, day.kcal! / kcalTop * 300)} role="button" tabIndex={0} aria-label={`Food for ${formatWeightDate(day.date)}: ${day.kcal} kcal`} aria-describedby={hover === day.date ? tooltipId : undefined} onClick={() => onOpenDay(day.date)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenDay(day.date) } }} onFocus={() => setHover(day.date)} onBlur={() => setHover(null)}><title>{formatWeightDate(day.date)} · {day.kcal} kcal</title></rect>)}
        <line className="weight-chart__today" x1={x(today)} x2={x(today)} y1="0" y2="300" />
        {goal.length > 0 && <path className="weight-chart__goal" d={path(goal)} />}
        {predicted.length > 0 && <path className="weight-chart__forecast" d={path(predicted)} />}
        <path className="weight-chart__raw" d={path(weights)} />
        {weights.map(entry => <path key={entry.date} className="weight-chart__dot" d={`M${x(entry.date)},${y(entry.weightKg)}h0`} />)}
        <path className="weight-chart__trend" d={path(trend)} />
        {hover && <line className="weight-chart__cursor" x1={x(hover)} x2={x(hover)} y1="0" y2="300" />}
      </svg>
      {hover && <div id={tooltipId} role="tooltip" className="weight-chart__tooltip" style={{ left: `${hoverPercent}%`, transform: `translateX(-${hoverPercent}%)` }}>
        <time>{formatWeightDate(hover)}</time><span>Weigh-in <strong>{currentWeight ? `${currentWeight.weightKg.toFixed(2)} kg` : '—'}</strong></span><span>7-day average <strong>{currentTrend === null ? '—' : `${currentTrend.toFixed(2)} kg`}</strong></span>{currentTarget && <span>Target line <strong>{currentTarget.weightKg.toFixed(2)} kg</strong></span>}{showCalories && <><span>Food logged <strong>{currentFood?.kcal == null ? 'Unknown' : `${currentFood.kcal} kcal`}</strong></span>{currentFood?.kcal != null && <><span>Next morning <strong>{nextWeight ? `${nextWeight.weightKg.toFixed(2)} kg` : nextDate! > today ? 'Pending' : 'Not logged'}</strong></span><span>Overnight change <strong>{changeLabel}</strong></span></>}</>}
      </div>}
    </div>
    <div className="weight-chart__dates"><span>{compactWeightDate(first)}</span><span>{compactWeightDate(dateOf(start + Math.round(duration / 2)))}</span><span>{compactWeightDate(end)}</span></div>
    {showCalories && <small className="finance-muted weight-chart__note">Orange marks 3,000+ kcal days. Bars use the right-hand kcal scale. Hover or focus a bar to see the next morning’s weight change; open it to edit food. Missing logs stay unknown.</small>}
    {predicted.length > 0 && <small className="finance-muted weight-chart__note">The dotted line extends recent weight pace for up to 21 days. It is a conditional outlook.</small>}
  </article>
}
