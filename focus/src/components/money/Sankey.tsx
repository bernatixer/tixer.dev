// ============================================
// SANKEY — money flow visualization
// ============================================
//
// Hand-rolled SVG (no d3-sankey) to keep styling consistent with the
// brutalist aesthetic and avoid a dependency. Two-column layout:
// incomes on the left, expense categories + savings on the right.
//
// Flows are allocated proportionally: each income contributes to each
// sink in proportion to its share of total income. That's a reasonable
// default for a personal budget — refinement (manual income→bucket
// assignment) can come later if needed.

import { FC, useState } from 'react'
import {
  CATEGORY_BY_ID,
  OVERSPEND_COLOR,
  SAVINGS_COLOR,
  formatEUR,
  groupByCategory,
  toMonthlyCents,
  type Expense,
  type Income,
} from '@/money/types'

interface SankeyProps {
  incomes: Income[]
  expenses: Expense[]
}

interface Node {
  id: string
  label: string
  amount: number
  color: string
  y: number
  height: number
}

interface Flow {
  sourceId: string
  sinkId: string
  amount: number
  color: string
  srcYTop: number
  sinkYTop: number
  thickness: number
}

const NEUTRAL = '#888888'

const VIEW_WIDTH = 1000
const PADDING_X = 220       // room for labels on each side
const NODE_WIDTH = 14
const NODE_GAP = 6
const TOP_PAD = 14
const BOT_PAD = 14
const MIN_HEIGHT = 360
const PER_SINK_PX = 44

// Vertical space a 2-line label occupies (line1 ≈ -6 from center, line2 ≈ +8)
// plus a few px of breathing room between labels.
const LABEL_MIN_SPACING = 26

// Greedy collision resolver. Walks items sorted by desired Y, pushes each
// down to enforce minSpacing, then walks back to pull up anything that
// overflowed the bottom boundary. Returns resolved centers in original order.
function resolveLabelPositions(
  centersDesired: number[],
  minSpacing: number,
  topBoundary: number,
  bottomBoundary: number,
): number[] {
  const indexed = centersDesired.map((y, idx) => ({ idx, desired: y, resolved: y }))
  indexed.sort((a, b) => a.desired - b.desired)

  // First pass: push down
  let prev = topBoundary + minSpacing / 2 - minSpacing
  for (const it of indexed) {
    const lo = prev + minSpacing
    if (it.resolved < lo) it.resolved = lo
    prev = it.resolved
  }

  // Second pass (right→left): if anything overflows below, pull up
  let next = bottomBoundary - minSpacing / 2 + minSpacing
  for (let i = indexed.length - 1; i >= 0; i--) {
    const hi = next - minSpacing
    if (indexed[i].resolved > hi) indexed[i].resolved = hi
    next = indexed[i].resolved
  }

  const out = new Array<number>(centersDesired.length)
  for (const it of indexed) out[it.idx] = it.resolved
  return out
}

export const Sankey: FC<SankeyProps> = ({ incomes, expenses }) => {
  const [hoverFlow, setHoverFlow] = useState<string | null>(null)

  const sourceList = incomes.map((i) => ({
    id: i.id,
    label: i.label,
    amount: toMonthlyCents(i.amountCents, i.cadence),
    color: NEUTRAL,
  }))

  const groups = groupByCategory(expenses)
  const sinkList: { id: string; label: string; amount: number; color: string }[] = groups.map(
    (g) => ({
      id: g.category as string,
      label: CATEGORY_BY_ID[g.category].label,
      amount: g.monthlyCents,
      color: CATEGORY_BY_ID[g.category].color,
    }),
  )

  const totalIncome = sourceList.reduce((s, x) => s + x.amount, 0)
  const totalExpense = sinkList.reduce((s, x) => s + x.amount, 0)
  const balance = totalIncome - totalExpense

  if (balance > 0) {
    sinkList.push({ id: 'savings', label: 'Savings', amount: balance, color: SAVINGS_COLOR })
  } else if (balance < 0) {
    sinkList.push({
      id: 'overspend',
      label: 'Overspend',
      amount: Math.abs(balance),
      color: OVERSPEND_COLOR,
    })
  }

  const sinkTotal = sinkList.reduce((s, x) => s + x.amount, 0)
  const flowBasis = Math.max(totalIncome, sinkTotal, 1)

  // Height scales with number of sinks. The Sankey breathes better with
  // taller diagrams when there are many categories.
  const viewHeight = Math.max(
    MIN_HEIGHT,
    TOP_PAD + BOT_PAD + sinkList.length * PER_SINK_PX,
  )
  const innerHeight = viewHeight - TOP_PAD - BOT_PAD
  const maxNodesPerCol = Math.max(sourceList.length, sinkList.length)
  const gapPx = (maxNodesPerCol - 1) * NODE_GAP
  const pixelsPerCent = (innerHeight - gapPx) / flowBasis

  // Layout sources
  const sources: Node[] = []
  {
    let y = TOP_PAD
    for (const s of sourceList) {
      const h = s.amount * pixelsPerCent
      sources.push({ ...s, y, height: h })
      y += h + NODE_GAP
    }
  }

  // Layout sinks
  const sinks: Node[] = []
  {
    let y = TOP_PAD
    for (const s of sinkList) {
      const h = s.amount * pixelsPerCent
      sinks.push({ ...s, y, height: h })
      y += h + NODE_GAP
    }
  }

  // Build flows — proportional allocation
  const flows: Flow[] = []
  const sourceUsed = new Map<string, number>()
  const sinkUsed = new Map<string, number>()
  for (const source of sources) sourceUsed.set(source.id, 0)
  for (const sink of sinks) sinkUsed.set(sink.id, 0)

  // Iterate sinks then sources so flows are visually stacked by sink
  for (const sink of sinks) {
    for (const source of sources) {
      if (totalIncome <= 0) continue
      const portion = (source.amount / totalIncome) * sink.amount
      if (portion <= 0) continue
      const sourceOffset = sourceUsed.get(source.id) ?? 0
      const sinkOffset = sinkUsed.get(sink.id) ?? 0
      const thickness = portion * pixelsPerCent
      flows.push({
        sourceId: source.id,
        sinkId: sink.id,
        amount: portion,
        color: sink.color,
        srcYTop: source.y + sourceOffset,
        sinkYTop: sink.y + sinkOffset,
        thickness,
      })
      sourceUsed.set(source.id, sourceOffset + thickness)
      sinkUsed.set(sink.id, sinkOffset + thickness)
    }
  }

  if (totalIncome === 0 || sinkList.length === 0) {
    return (
      <section className="sankey">
        <div className="sankey__label">FLOW OF MONEY</div>
        <div className="sankey__empty">
          Add at least one income and one expense to see the money flow.
        </div>
      </section>
    )
  }

  const srcRightX = PADDING_X
  const sinkLeftX = VIEW_WIDTH - PADDING_X
  const cx1 = srcRightX + NODE_WIDTH + (sinkLeftX - srcRightX - NODE_WIDTH) * 0.45
  const cx2 = srcRightX + NODE_WIDTH + (sinkLeftX - srcRightX - NODE_WIDTH) * 0.55

  // Resolve label centers separately from node centers — small categories
  // would otherwise stack their labels on top of each other.
  const sourceLabelY = resolveLabelPositions(
    sources.map((s) => s.y + s.height / 2),
    LABEL_MIN_SPACING,
    TOP_PAD,
    viewHeight - BOT_PAD,
  )
  const sinkLabelY = resolveLabelPositions(
    sinks.map((s) => s.y + s.height / 2),
    LABEL_MIN_SPACING,
    TOP_PAD,
    viewHeight - BOT_PAD,
  )

  return (
    <section className="sankey">
      <div className="sankey__label">FLOW OF MONEY</div>
      <div className="sankey__chart">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
          width="100%"
          height={viewHeight}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Money flow diagram"
        >
          {/* Flow ribbons */}
          {flows.map((f, i) => {
            const x1 = srcRightX + NODE_WIDTH
            const x2 = sinkLeftX
            // Build a closed ribbon: top edge (left→right), then bottom
            // edge back (right→left), then close.
            const top = `M ${x1} ${f.srcYTop} C ${cx1} ${f.srcYTop}, ${cx2} ${f.sinkYTop}, ${x2} ${f.sinkYTop}`
            const bot = `L ${x2} ${f.sinkYTop + f.thickness} C ${cx2} ${f.sinkYTop + f.thickness}, ${cx1} ${f.srcYTop + f.thickness}, ${x1} ${f.srcYTop + f.thickness} Z`
            const key = `${f.sourceId}-${f.sinkId}`
            const dim = hoverFlow && hoverFlow !== key
            return (
              <path
                key={i}
                d={top + bot}
                fill={f.color}
                opacity={dim ? 0.12 : hoverFlow === key ? 0.85 : 0.45}
                onMouseEnter={() => setHoverFlow(key)}
                onMouseLeave={() => setHoverFlow(null)}
                style={{ transition: 'opacity 0.15s', cursor: 'crosshair' }}
              >
                <title>
                  {(sources.find((s) => s.id === f.sourceId)?.label ?? '')} →{' '}
                  {(sinks.find((s) => s.id === f.sinkId)?.label ?? '')} ·{' '}
                  {formatEUR(f.amount)}/mo
                </title>
              </path>
            )
          })}

          {/* Source nodes (incomes) */}
          {sources.map((s, i) => {
            const nodeCenter = s.y + s.height / 2
            const labelY = sourceLabelY[i]
            const offset = Math.abs(labelY - nodeCenter)
            return (
              <g key={s.id}>
                <rect x={srcRightX} y={s.y} width={NODE_WIDTH} height={s.height} fill={s.color} />
                {offset > 4 && (
                  <path
                    d={`M ${srcRightX - 2} ${nodeCenter} L ${srcRightX - 6} ${labelY}`}
                    stroke={s.color}
                    strokeWidth={1}
                    opacity={0.45}
                    fill="none"
                  />
                )}
                <text x={srcRightX - 10} y={labelY - 6} textAnchor="end"
                      className="sankey-text sankey-text--label" fill="currentColor">
                  {s.label.toUpperCase()}
                </text>
                <text x={srcRightX - 10} y={labelY + 8} textAnchor="end"
                      className="sankey-text sankey-text--amount" fill="currentColor">
                  {formatEUR(s.amount)}
                </text>
              </g>
            )
          })}

          {/* Sink nodes (expenses + savings/overspend) */}
          {sinks.map((s, i) => {
            const nodeCenter = s.y + s.height / 2
            const labelY = sinkLabelY[i]
            const offset = Math.abs(labelY - nodeCenter)
            const accent =
              s.id === 'savings' ? 'sankey-text--accent' : s.id === 'overspend' ? 'sankey-text--danger' : ''
            return (
              <g key={s.id}>
                <rect x={sinkLeftX} y={s.y} width={NODE_WIDTH} height={s.height} fill={s.color} />
                {offset > 4 && (
                  <path
                    d={`M ${sinkLeftX + NODE_WIDTH + 2} ${nodeCenter} L ${sinkLeftX + NODE_WIDTH + 6} ${labelY}`}
                    stroke={s.color}
                    strokeWidth={1}
                    opacity={0.45}
                    fill="none"
                  />
                )}
                <text x={sinkLeftX + NODE_WIDTH + 10} y={labelY - 6} textAnchor="start"
                      className={`sankey-text sankey-text--label ${accent}`} fill="currentColor">
                  {s.label.toUpperCase()}
                </text>
                <text x={sinkLeftX + NODE_WIDTH + 10} y={labelY + 8} textAnchor="start"
                      className={`sankey-text sankey-text--amount ${accent}`} fill="currentColor">
                  {formatEUR(s.amount)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="sankey__help">
        Hover a ribbon to isolate. Width = €/mo. Proportional split of each income across all categories.
      </div>
    </section>
  )
}
