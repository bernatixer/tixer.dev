// ============================================
// SUBTASKS COMPONENT
// ============================================

import { FC, MouseEvent } from 'react'
import type { Subtask } from '@/todo/types'

interface SubtaskItemProps {
  subtask: Subtask
  onToggle: (subtaskId: string) => void
}

const SubtaskItem: FC<SubtaskItemProps> = ({ subtask, onToggle }) => {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const handleChange = () => {
    onToggle(subtask.id)
  }

  return (
    <label
      className={`subtask-item ${subtask.completed ? 'completed' : ''}`}
      data-subtask-id={subtask.id}
      onClick={handleClick}
    >
      <input
        type="checkbox"
        className="subtask-checkbox"
        checked={subtask.completed}
        onChange={handleChange}
      />
      <span className="subtask-text">{subtask.text}</span>
    </label>
  )
}

interface SubtasksContainerProps {
  subtasks: Subtask[]
  onToggle: (subtaskId: string) => void
}

export const SubtasksContainer: FC<SubtasksContainerProps> = ({ subtasks, onToggle }) => {
  return (
    <div className="subtasks-container">
      {subtasks.map(subtask => (
        <SubtaskItem key={subtask.id} subtask={subtask} onToggle={onToggle} />
      ))}
    </div>
  )
}

// ============================================
// PROGRESS CHIP
// ============================================

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

