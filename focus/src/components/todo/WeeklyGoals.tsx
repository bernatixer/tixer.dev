// ============================================
// WEEKLY GOALS — Bono-loto card
// ============================================

import { FC, useState } from 'react'
import { useCreateWeeklyGoal, useDeleteWeeklyGoal, useUpdateWeeklyGoal, useWeeklyGoals } from '@/hooks'
import {
  formatWeekRange,
  goalFlavor,
  goalProgressFraction,
  isGoalComplete,
  type WeeklyGoal,
} from '@/todo/goals'
import { WeeklyGoalModal } from './WeeklyGoalModal'

// ============================================
// CELL
// ============================================

interface CellProps {
  goal: WeeklyGoal
  onClick: () => void
  onEdit: () => void
}

const CheckIcon: FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="4 12 10 18 20 6" />
  </svg>
)

const RepeatIcon: FC = () => (
  <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 5 3 2 6 2" />
    <path d="M3 5a5 5 0 0 1 10 0" />
    <polyline points="13 11 13 14 10 14" />
    <path d="M13 11a5 5 0 0 1-10 0" />
  </svg>
)

// Bold neo-brutalist trophy — solid silhouette in `currentColor`. Handles
// drawn first as filled C-shapes so the cup overlaps them, leaving each
// handle as a clean bump on the outside of the cup.
const TrophyIcon: FC = () => (
  <svg
    className="weekly-goals__trophy-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    {/* Left handle */}
    <path d="M5 5 C1 5 1 12 5 12 L5 11 C3 10 3 7 5 6 Z" />
    {/* Right handle */}
    <path d="M19 5 C23 5 23 12 19 12 L19 11 C21 10 21 7 19 6 Z" />
    {/* Cup */}
    <path d="M5 3 H19 V11 C19 14.5 15.5 16.5 12 16.5 C8.5 16.5 5 14.5 5 11 Z" />
    {/* Stem + stepped base */}
    <rect x="11" y="16.5" width="2" height="2.5" />
    <rect x="8" y="19" width="8" height="1.5" />
    <rect x="6" y="20.5" width="12" height="1.5" />
  </svg>
)

const Cell: FC<CellProps> = ({ goal, onClick, onEdit }) => {
  const flavor = goalFlavor(goal)
  const fraction = goalProgressFraction(goal)
  const complete = isGoalComplete(goal)

  const className = [
    'wg-cell',
    `wg-cell--${flavor}`,
    complete ? 'wg-cell--complete' : 'wg-cell--incomplete',
    fraction > 0 && !complete ? 'wg-cell--partial' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onEdit()
      }}
      title={`${goal.title} — right-click to edit`}
      aria-label={goal.title}
    >
      <span
        className="wg-cell__fill"
        style={{ transform: `scaleY(${fraction})` }}
        aria-hidden
      />
      <span className="wg-cell__content">
        <span className="wg-cell__title">{goal.title}</span>
        <span className="wg-cell__state">
          {complete ? (
            <CheckIcon />
          ) : flavor === 'simple' ? (
            <span className="wg-cell__simple">·</span>
          ) : (
            <span className="wg-cell__counter">
              {goal.progress}<span className="wg-cell__divider">/</span>{goal.target}
            </span>
          )}
        </span>
      </span>
      {goal.recurring && (
        <span className="wg-cell__badge" title="Recurring weekly">
          <RepeatIcon />
        </span>
      )}
    </button>
  )
}

// ============================================
// WEEKLY GOALS BOARD
// ============================================

export const WeeklyGoals: FC<{ enabled: boolean }> = ({ enabled }) => {
  const { data, isLoading } = useWeeklyGoals(enabled)
  const { mutate: updateGoal } = useUpdateWeeklyGoal()
  const { mutate: deleteGoal } = useDeleteWeeklyGoal()
  const { mutate: createGoal } = useCreateWeeklyGoal()

  const [editingGoal, setEditingGoal] = useState<WeeklyGoal | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const goals = data?.goals ?? []
  const weekStart = data?.weekStart
  const completed = goals.filter(isGoalComplete).length
  const total = goals.length
  const allComplete = total > 0 && completed === total

  const handleCellClick = (goal: WeeklyGoal) => {
    if (goalFlavor(goal) === 'simple') {
      updateGoal({
        ...goal,
        progress: isGoalComplete(goal) ? 0 : 1,
      })
      return
    }
    // counter — tap to +1, tap on full to reset
    const next = isGoalComplete(goal) ? 0 : Math.min(goal.target, goal.progress + 1)
    updateGoal({ ...goal, progress: next })
  }

  if (!enabled) return null

  return (
    <section className={`weekly-goals ${collapsed ? 'weekly-goals--collapsed' : ''}`}>
      <header className="weekly-goals__header">
        <div className="weekly-goals__title-block">
          <button
            type="button"
            className="weekly-goals__collapse"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand weekly goals' : 'Collapse weekly goals'}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="2 3.5 5 6.5 8 3.5" />
            </svg>
          </button>
          <span className="weekly-goals__label">THIS WEEK</span>
          {weekStart && (
            <span className="weekly-goals__range">{formatWeekRange(weekStart)}</span>
          )}
          {allComplete && (
            <span className="weekly-goals__trophy">
              <TrophyIcon />
              <span>WEEK CLEARED</span>
            </span>
          )}
        </div>
        <div className="weekly-goals__meta">
          <span className={`weekly-goals__tally ${allComplete ? 'weekly-goals__tally--won' : ''}`}>
            <span className="weekly-goals__tally-num">{completed}</span>
            <span className="weekly-goals__tally-divider">/</span>
            <span className="weekly-goals__tally-den">{total}</span>
          </span>
        </div>
      </header>

      {!collapsed && (
        <div className={`weekly-goals__grid ${allComplete ? 'weekly-goals__grid--won' : ''}`}>
          {isLoading && total === 0 ? (
            <div className="weekly-goals__loading">Loading goals…</div>
          ) : (
            <>
              {goals.map((goal) => (
                <Cell
                  key={goal.id}
                  goal={goal}
                  onClick={() => handleCellClick(goal)}
                  onEdit={() => setEditingGoal(goal)}
                />
              ))}
              <button
                type="button"
                className="wg-cell wg-cell--add"
                onClick={() => setIsCreating(true)}
                aria-label="Add weekly goal"
                title="Add weekly goal"
              >
                <span className="wg-cell__add-plus">+</span>
                <span className="wg-cell__add-label">ADD GOAL</span>
              </button>
            </>
          )}
        </div>
      )}

      <WeeklyGoalModal
        isOpen={isCreating}
        weekStart={weekStart ?? null}
        onClose={() => setIsCreating(false)}
        onSubmit={(payload) => {
          createGoal(payload)
          setIsCreating(false)
        }}
      />

      <WeeklyGoalModal
        isOpen={!!editingGoal}
        weekStart={editingGoal?.weekStart ?? null}
        existing={editingGoal ?? undefined}
        onClose={() => setEditingGoal(null)}
        onDelete={() => {
          if (editingGoal) deleteGoal(editingGoal.id)
          setEditingGoal(null)
        }}
        onSubmit={(payload) => {
          if (editingGoal) {
            updateGoal({
              ...editingGoal,
              ...payload,
            })
          }
          setEditingGoal(null)
        }}
      />
    </section>
  )
}
