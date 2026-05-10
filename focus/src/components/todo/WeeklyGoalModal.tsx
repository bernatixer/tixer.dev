// ============================================
// WEEKLY GOAL MODAL — create / edit
// ============================================

import { FC, FormEvent, useEffect, useRef, useState } from 'react'
import type { WeeklyGoal, WeeklyGoalCreate } from '@/todo/goals'
import { mondayOf } from '@/todo/goals'

type GoalKind = 'simple' | 'counter'

const detectKind = (goal: WeeklyGoal | undefined): GoalKind =>
  goal && goal.target > 1 ? 'counter' : 'simple'

interface WeeklyGoalModalProps {
  isOpen: boolean
  weekStart: string | null
  existing?: WeeklyGoal
  onClose: () => void
  onSubmit: (payload: WeeklyGoalCreate) => void
  onDelete?: () => void
}

export const WeeklyGoalModal: FC<WeeklyGoalModalProps> = ({
  isOpen,
  weekStart,
  existing,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<GoalKind>('simple')
  const [target, setTarget] = useState(3)
  const [recurring, setRecurring] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    if (existing) {
      setTitle(existing.title)
      setKind(detectKind(existing))
      setTarget(existing.target > 1 ? existing.target : 3)
      setRecurring(existing.recurring)
    } else {
      setTitle('')
      setKind('simple')
      setTarget(3)
      setRecurring(false)
    }
    requestAnimationFrame(() => titleRef.current?.focus())
  }, [isOpen, existing])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    const resolvedTarget = kind === 'counter' ? Math.max(1, target) : 1
    const resolvedProgress = existing
      ? Math.min(existing.progress, resolvedTarget)
      : 0

    onSubmit({
      weekStart: weekStart ?? mondayOf(new Date()),
      title: trimmed,
      target: resolvedTarget,
      progress: resolvedProgress,
      recurring,
      order: existing?.order ?? Date.now(),
    })
  }

  const isEdit = !!existing

  return (
    <div className="new-task-overlay" onClick={onClose}>
      <div className="new-task-card-wrapper" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="task-card variant-active wg-modal">
          <div className="wg-modal__header">
            <span className="wg-modal__heading">
              {isEdit ? 'Edit weekly goal' : 'New weekly goal'}
            </span>
            <button type="button" className="wg-modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <input
            ref={titleRef}
            type="text"
            className="wg-modal__title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal title — e.g. Go to gym"
          />

          <div className="wg-modal__kind">
            {(['simple', 'counter'] as GoalKind[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`wg-modal__kind-btn ${kind === k ? 'active' : ''}`}
                onClick={() => setKind(k)}
              >
                {k === 'simple' ? 'Simple' : 'Counter'}
              </button>
            ))}
          </div>

          <p className="wg-modal__hint">
            {kind === 'simple'
              ? 'A one-shot goal. Click the cell to mark it done.'
              : 'A counter — click the cell to +1 each time.'}
          </p>

          {kind === 'counter' && (
            <div className="wg-modal__counter">
              <span className="wg-modal__field-label">Target</span>
              <div className="wg-modal__counter-controls">
                <button
                  type="button"
                  onClick={() => setTarget((t) => Math.max(2, t - 1))}
                  className="wg-modal__counter-btn"
                  disabled={target <= 2}
                >
                  −
                </button>
                <span className="wg-modal__counter-value">{target}</span>
                <button
                  type="button"
                  onClick={() => setTarget((t) => Math.min(99, t + 1))}
                  className="wg-modal__counter-btn"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <label className="wg-modal__recurring">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            <span>Recurring — refresh every Monday with progress reset</span>
          </label>

          <div className="wg-modal__actions">
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="wg-modal__delete-btn"
              >
                Delete
              </button>
            )}
            <button type="button" onClick={onClose} className="new-task-btn-cancel">
              Cancel
            </button>
            <button
              type="submit"
              className="new-task-btn-create"
              disabled={!title.trim()}
            >
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
