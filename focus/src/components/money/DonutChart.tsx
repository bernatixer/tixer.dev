// ============================================
// DONUT CHART — expense mix by category
// ============================================
//
// Hand-rolled SVG donut. Shows the composition of expenses (savings is
// not included — the Sankey already shows income → savings flow; this
// chart's job is to answer "of what I spend, where does it go?").
//
// Click a slice OR a legend row to hide that category from this chart.
// Hiding is local UI state (per-session) — analytics elsewhere are
// unaffected. A "Show all" hint appears when anything is hidden.

import { FC, useState } from 'react'
import {
  CATEGORY_BY_ID,
  formatEUR,
  groupByCategory,
  type Category,
  type Expense,
} from '@/money/types'

interface DonutProps {
  expenses: Expense[]
}

const VIEW = 240
const CENTER = VIEW / 2
const R_OUTER = 100
const R_INNER = 62

// Build an SVG path for a donut slice from startAngle to endAngle (radians).
// Angles are measured clockwise from the top (12 o'clock).
function arcPath(start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0
  const x1 = CENTER + R_OUTER * Math.sin(start)
  const y1 = CENTER - R_OUTER * Math.cos(start)
  const x2 = CENTER + R_OUTER * Math.sin(end)
  const y2 = CENTER - R_OUTER * Math.cos(end)
  const x3 = CENTER + R_INNER * Math.sin(end)
  const y3 = CENTER - R_INNER * Math.cos(end)
  const x4 = CENTER + R_INNER * Math.sin(start)
  const y4 = CENTER - R_INNER * Math.cos(start)
  return [
    `M ${x1} ${y1}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ')
}

export const DonutChart: FC<DonutProps> = ({ expenses }) => {
  const groups = groupByCategory(expenses)
  const grandTotal = groups.reduce((s, g) => s + g.monthlyCents, 0)
  const [hover, setHover] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<Category>>(new Set())

  if (grandTotal === 0) {
    return (
      <section className="donut">
        <div className="donut__label">EXPENSE MIX</div>
        <div className="donut__empty">No expenses yet.</div>
      </section>
    )
  }

  const toggleHidden = (cat: Category) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const visibleGroups = groups.filter((g) => !hidden.has(g.category))
  const visibleTotal = visibleGroups.reduce((s, g) => s + g.monthlyCents, 0)

  // Compute slices ONLY from visible groups so percentages rebalance.
  let angle = 0
  const slices = visibleGroups.map((g) => {
    const start = angle
    const sweep = visibleTotal > 0 ? (g.monthlyCents / visibleTotal) * Math.PI * 2 : 0
    angle += sweep
    return {
      id: g.category,
      label: CATEGORY_BY_ID[g.category].label,
      color: CATEGORY_BY_ID[g.category].color,
      monthlyCents: g.monthlyCents,
      pct: visibleTotal > 0 ? (g.monthlyCents / visibleTotal) * 100 : 0,
      start,
      end: angle,
    }
  })

  // Index for quick legend → slice lookup (so the legend can show the
  // recomputed % for visible categories).
  const sliceById = new Map(slices.map((s) => [s.id, s]))

  const hoverSlice = hover ? sliceById.get(hover as Category) : undefined
  const centerAmount = hoverSlice?.monthlyCents ?? visibleTotal
  const centerSubtitle = hoverSlice
    ? `${hoverSlice.label.toUpperCase()} · ${hoverSlice.pct.toFixed(0)}%`
    : hidden.size > 0
      ? `TOTAL · ${groups.length - hidden.size} of ${groups.length}`
      : 'TOTAL · MONTHLY'

  return (
    <section className="donut">
      <div className="donut__label">
        EXPENSE MIX
        {hidden.size > 0 && (
          <button
            type="button"
            className="donut__restore"
            onClick={() => setHidden(new Set())}
            title="Show every category again"
          >
            Show all ({hidden.size} hidden)
          </button>
        )}
      </div>
      <div className="donut__chart">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width="100%" height={VIEW} role="img" aria-label="Expense mix donut">
          {slices.length === 0 ? (
            <circle cx={CENTER} cy={CENTER} r={R_OUTER} fill="none"
              stroke="rgba(var(--white-rgb), 0.1)" strokeWidth={R_OUTER - R_INNER}
              strokeDasharray="2 4" />
          ) : (
            slices.map((sl) => {
              const dim = hover && hover !== sl.id
              return (
                <path
                  key={sl.id}
                  d={arcPath(sl.start, sl.end)}
                  fill={sl.color}
                  opacity={dim ? 0.2 : 1}
                  onMouseEnter={() => setHover(sl.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => toggleHidden(sl.id)}
                  style={{ transition: 'opacity 0.15s', cursor: 'pointer' }}
                >
                  <title>
                    {sl.label} · {formatEUR(sl.monthlyCents)}/mo · {sl.pct.toFixed(1)}% · click to hide
                  </title>
                </path>
              )
            })
          )}
          <text
            x={CENTER}
            y={CENTER - 6}
            textAnchor="middle"
            className="donut-text donut-text--total"
            fill="currentColor"
          >
            {formatEUR(centerAmount)}
          </text>
          <text
            x={CENTER}
            y={CENTER + 12}
            textAnchor="middle"
            className="donut-text donut-text--sub"
            fill="currentColor"
          >
            {centerSubtitle}
          </text>
        </svg>
      </div>
      <div className="donut__legend">
        {groups.map((g) => {
          const isHidden = hidden.has(g.category)
          const slice = sliceById.get(g.category)
          const pct = slice ? slice.pct : 0
          const config = CATEGORY_BY_ID[g.category]
          return (
            <div
              key={g.category}
              className={`donut__legend-row ${hover === g.category ? 'donut__legend-row--active' : ''} ${isHidden ? 'donut__legend-row--hidden' : ''}`}
              onMouseEnter={() => !isHidden && setHover(g.category)}
              onMouseLeave={() => setHover(null)}
              onClick={() => toggleHidden(g.category)}
              role="button"
              title={isHidden ? 'Click to show in chart' : 'Click to hide from chart'}
            >
              <span className="donut__legend-dot" style={{ background: config.color }} />
              <span className="donut__legend-label">{config.label}</span>
              <span className="donut__legend-pct">{isHidden ? '—' : `${pct.toFixed(0)}%`}</span>
              <span className="donut__legend-amt">{formatEUR(g.monthlyCents)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
