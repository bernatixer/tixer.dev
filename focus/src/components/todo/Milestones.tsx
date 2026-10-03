import { FC, KeyboardEvent, MouseEvent, ReactNode, RefObject, useState } from 'react'
import type { Milestone } from '@/todo/types'

// Markdown links: [label](url). Only http(s)/mailto get linkified.
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g
const isSafeHref = (url: string) => /^(https?:\/\/|mailto:)/i.test(url)

const renderMilestoneText = (text: string): ReactNode => {
  const parts: ReactNode[] = []
  let last = 0

  for (const match of text.matchAll(LINK_RE)) {
    const [raw, label, url] = match
    const start = match.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      isSafeHref(url) ? (
        <a
          key={start}
          className="milestone-link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title={url}
        >
          {label}
        </a>
      ) : (
        raw
      )
    )
    last = start + raw.length
  }

  if (last === 0) return text
  parts.push(text.slice(last))
  return parts
}

interface MilestonesSectionProps {
  milestones: Milestone[]
  onToggle: (milestoneId: string) => void
  onDelete?: (milestoneId: string) => void
  onReorder?: (from: number, to: number) => void
  newMilestoneText?: string
  onNewMilestoneTextChange?: (value: string) => void
  onAddMilestone?: (event: MouseEvent | KeyboardEvent) => void
  onNewMilestoneKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  inputRef?: RefObject<HTMLInputElement>
  variant?: 'active' | 'compact'
}

export const MilestonesSection: FC<MilestonesSectionProps> = ({
  milestones,
  onToggle,
  onDelete,
  onReorder,
  newMilestoneText = '',
  onNewMilestoneTextChange,
  onAddMilestone,
  onNewMilestoneKeyDown,
  inputRef,
  variant = 'compact',
}) => {
  const isActive = variant === 'active'
  const wrapperClassName = isActive ? 'active-milestones' : 'subtasks-container'
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  // Drop target as a gap between rows: 0 = above the first, length = below the last.
  const [overGap, setOverGap] = useState<number | null>(null)

  const endDrag = () => {
    setDragIndex(null)
    setOverGap(null)
  }

  // Gaps on either side of the dragged row would be a no-op, so they show no line.
  const showGap = (gap: number) =>
    dragIndex !== null && overGap === gap && gap !== dragIndex && gap !== dragIndex + 1

  const dragProps = (index: number) =>
    onReorder && milestones.length > 1
      ? {
          draggable: true,
          // keep the card's dnd-kit pointer sensor out of a milestone drag
          onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
          onDragStart: () => setDragIndex(index),
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault()
            const { top, height } = e.currentTarget.getBoundingClientRect()
            setOverGap(e.clientY > top + height / 2 ? index + 1 : index)
          },
          onDragEnd: endDrag,
          onDrop: (e: React.DragEvent) => {
            e.preventDefault()
            if (dragIndex !== null && overGap !== null) {
              // removing the dragged row first shifts every later gap up by one
              const to = overGap > dragIndex ? overGap - 1 : overGap
              if (to !== dragIndex) onReorder(dragIndex, to)
            }
            endDrag()
          },
        }
      : {}

  return (
    <div className={wrapperClassName} onClick={e => e.stopPropagation()}>
      {milestones.map((milestone, index) => (
        <label
          key={milestone.id}
          className={[
            isActive ? 'milestone-item' : 'subtask-item',
            milestone.completed ? 'completed' : '',
            dragIndex === index ? 'dragging' : '',
            showGap(index) ? 'drag-over' : '',
            index === milestones.length - 1 && showGap(milestones.length) ? 'drag-over-end' : '',
          ].filter(Boolean).join(' ')}
          onClick={e => e.stopPropagation()}
          {...dragProps(index)}
        >
          {onReorder && milestones.length > 1 && (
            <span className="milestone-grip" aria-hidden="true">⠿</span>
          )}
          <input
            type="checkbox"
            className="subtask-checkbox"
            checked={milestone.completed}
            onChange={() => onToggle(milestone.id)}
          />
          <span className={isActive ? 'milestone-text' : 'subtask-text'}>
            {renderMilestoneText(milestone.text)}
          </span>
          {onDelete && (
            <button
              className="milestone-delete"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onDelete(milestone.id)
              }}
              title="Remove milestone"
            >
              &times;
            </button>
          )}
        </label>
      ))}

      {onNewMilestoneTextChange && onAddMilestone && onNewMilestoneKeyDown && (
        <div className={isActive ? 'milestone-add' : 'add-subtask-section'}>
          <input
            ref={inputRef}
            type="text"
            className={isActive ? 'milestone-add-input' : 'add-subtask-input'}
            value={newMilestoneText}
            onChange={e => onNewMilestoneTextChange(e.target.value)}
            onKeyDown={onNewMilestoneKeyDown}
            placeholder="Add milestone…"
            onClick={e => e.stopPropagation()}
          />
          {!isActive && newMilestoneText.trim() && (
            <button type="button" className="add-subtask-btn" onClick={onAddMilestone}>
              Add
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface ProgressChipProps {
  completed: number
  total: number
}

export const ProgressChip: FC<ProgressChipProps> = ({ completed, total }) => {
  const isComplete = completed === total && total > 0
  const isEmpty = completed === 0

  let className = 'progress-chip'
  if (isComplete) className += ' complete'
  if (isEmpty) className += ' empty'

  return <span className={className}>{completed}/{total}</span>
}
