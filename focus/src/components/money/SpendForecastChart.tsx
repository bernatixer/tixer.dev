// ============================================
// SPEND FORECAST CHART — daily cumulative line, this month vs last
// ============================================
//
// Two lines: last month (dim) and this month (acid). A vertical
// "today" marker. A dashed projection from today → end of month based
// on the current daily rate.

import { FC, useMemo } from 'react'
import {
  cumulativeSpendByDay,
  forecastMonth,
  previousMonthKey,
  type BankTransaction,
} from '@/money/bank'
import { formatEUR } from '@/money/types'

interface Props {
  transactions: BankTransaction[]
  currentMonth: string   // 'YYYY-MM'
}

const VIEW_W = 640
const VIEW_H = 200
const PAD_T = 14
const PAD_R = 12
const PAD_B = 22
const PAD_L = 52

export const SpendForecastChart: FC<Props> = ({ transactions, currentMonth }) => {
  const lastMonth = previousMonthKey(currentMonth)

  const { current, previous, forecast } = useMemo(() => {
    return {
      current: cumulativeSpendByDay(transactions, currentMonth),
      previous: cumulativeSpendByDay(transactions, lastMonth),
      forecast: forecastMonth(transactions, currentMonth),
    }
  }, [transactions, currentMonth, lastMonth])

  const maxDay = Math.max(current.length, previous.length)
  const maxCents = Math.max(
    forecast.projectedTotalCents,
    ...current.map((p) => p.cumulativeCents),
    ...previous.map((p) => p.cumulativeCents),
    1,
  )
  // Round max up to a "nice" value so the y-axis labels look clean.
  const niceMax = niceCeil(maxCents)

  const innerW = VIEW_W - PAD_L - PAD_R
  const innerH = VIEW_H - PAD_T - PAD_B

  const xOf = (day: number) => PAD_L + ((day - 1) / Math.max(maxDay - 1, 1)) * innerW
  const yOf = (cents: number) => PAD_T + innerH - (cents / niceMax) * innerH

  // Truncate the current-month line at the last day with actual data
  const currentTrimmed = current.slice(0, forecast.daysElapsed)

  // Forecast line: from last current point straight to (daysInMonth, projected)
  const lastCurrentPoint =
    currentTrimmed[currentTrimmed.length - 1] ?? { day: 1, cumulativeCents: 0 }
  const projectionPath = `M ${xOf(lastCurrentPoint.day)} ${yOf(lastCurrentPoint.cumulativeCents)} L ${xOf(forecast.daysInMonth)} ${yOf(forecast.projectedTotalCents)}`

  const projectedHigher =
    forecast.projectedTotalCents >
    (previous[previous.length - 1]?.cumulativeCents ?? 0)

  return (
    <div className="forecast-chart">
      <div className="forecast-chart__head">
        <div className="forecast-chart__head-left">
          <span className="forecast-chart__label">SPEND PACE</span>
          <span className="forecast-chart__head-detail">
            Day {forecast.daysElapsed} of {forecast.daysInMonth} · {formatEUR(forecast.spentSoFarCents)} spent ·{' '}
            <span className={`forecast-chart__projection ${projectedHigher ? 'is-up' : 'is-down'}`}>
              proj. {formatEUR(forecast.projectedTotalCents)}
            </span>
          </span>
        </div>
        <div className="forecast-chart__legend">
          <span className="forecast-chart__legend-item">
            <span className="forecast-chart__swatch forecast-chart__swatch--current" />
            this month
          </span>
          <span className="forecast-chart__legend-item">
            <span className="forecast-chart__swatch forecast-chart__swatch--previous" />
            last month
          </span>
          <span className="forecast-chart__legend-item">
            <span className="forecast-chart__swatch forecast-chart__swatch--forecast" />
            forecast
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height={VIEW_H} role="img" aria-label="Spend forecast">
        {/* y-axis grid: 4 horizontal lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = PAD_T + innerH - frac * innerH
          const v = frac * niceMax
          return (
            <g key={frac}>
              <line x1={PAD_L} x2={VIEW_W - PAD_R} y1={y} y2={y}
                stroke="rgba(var(--white-rgb), 0.06)" strokeWidth={1} />
              <text x={PAD_L - 6} y={y + 3} className="forecast-chart__y-label" textAnchor="end" fill="currentColor">
                {formatEUR(v)}
              </text>
            </g>
          )
        })}

        {/* x-axis labels */}
        {[1, 7, 14, 21, 28].filter((d) => d <= maxDay).map((d) => (
          <text key={d} x={xOf(d)} y={VIEW_H - 6}
            textAnchor="middle" className="forecast-chart__x-label" fill="currentColor">
            {d}
          </text>
        ))}

        {/* Last month line (dim) */}
        {previous.length > 1 && (
          <polyline
            fill="none"
            stroke="rgba(var(--white-rgb), 0.35)"
            strokeWidth={1.5}
            points={previous.map((p) => `${xOf(p.day)},${yOf(p.cumulativeCents)}`).join(' ')}
          />
        )}

        {/* This month line (acid) */}
        {currentTrimmed.length > 1 && (
          <polyline
            fill="none"
            stroke="var(--acid)"
            strokeWidth={2}
            points={currentTrimmed.map((p) => `${xOf(p.day)},${yOf(p.cumulativeCents)}`).join(' ')}
          />
        )}

        {/* Forecast (dashed acid) */}
        {currentTrimmed.length > 0 && forecast.daysElapsed < forecast.daysInMonth && (
          <path
            d={projectionPath}
            fill="none"
            stroke="var(--acid)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.7}
          />
        )}

        {/* Today marker */}
        {forecast.daysElapsed > 0 && forecast.daysElapsed <= forecast.daysInMonth && (
          <line
            x1={xOf(forecast.daysElapsed)}
            x2={xOf(forecast.daysElapsed)}
            y1={PAD_T}
            y2={PAD_T + innerH}
            stroke="rgba(var(--acid-rgb), 0.3)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        )}
      </svg>
    </div>
  )
}

// Round up to a "nice" value for axis labels (1, 2, 5 × power of 10).
function niceCeil(value: number): number {
  if (value <= 0) return 100
  const pow = Math.pow(10, Math.floor(Math.log10(value)))
  const norm = value / pow
  let multiplier: number
  if (norm <= 1) multiplier = 1
  else if (norm <= 2) multiplier = 2
  else if (norm <= 5) multiplier = 5
  else multiplier = 10
  return multiplier * pow
}
