import { FC, KeyboardEvent, MouseEvent, RefObject } from 'react'
import type { Milestone } from '@/todo/types'

interface MilestonesSectionProps {
  milestones: Milestone[]
  onToggle: (milestoneId: string) => void
  onDelete?: (milestoneId: string) => void
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
  newMilestoneText = '',
  onNewMilestoneTextChange,
  onAddMilestone,
  onNewMilestoneKeyDown,
  inputRef,
  variant = 'compact',
}) => {
  const isActive = variant === 'active'
  const wrapperClassName = isActive ? 'active-milestones' : 'subtasks-container'

  return (
    <div className={wrapperClassName} onClick={e => e.stopPropagation()}>
      {milestones.map(milestone => (
        <label
          key={milestone.id}
          className={`${isActive ? 'milestone-item' : 'subtask-item'} ${milestone.completed ? 'completed' : ''}`}
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="subtask-checkbox"
            checked={milestone.completed}
            onChange={() => onToggle(milestone.id)}
          />
          <span className={isActive ? 'milestone-text' : 'subtask-text'}>{milestone.text}</span>
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
            placeholder="+ Add milestone..."
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
