// ============================================
// TASK CARD COMPONENT
// ============================================

import { FC, useState, MouseEvent, useRef, useEffect, KeyboardEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TagId, ColumnId, Priority } from '@/todo/types'
import { TASK_TYPES_BY_ID } from '@/todo/types'
import { useTaskAge } from '@/hooks/useAppState'
import { useToggleSubtask, useUnblockTask, useUpdateTask, useAddSubtask, useDeleteSubtask, useMoveTask } from '@/hooks/useTasks'
import { DueDateBadge } from './DueDateBadge'
import { SubtasksContainer, ProgressChip } from './Subtasks'
import { StatusCircle } from './StatusCircle'
import { PriorityPill } from './PriorityPill'
import { TagEditor } from './TagEditor'

// ============================================
// RECURRING BADGE
// ============================================

interface RecurringBadgeProps {
  recurrence: string
}

const RecurringBadge: FC<RecurringBadgeProps> = ({ recurrence }) => {
  const label = recurrence.charAt(0).toUpperCase() + recurrence.slice(1)
  return <span className="recurring-badge">{label}</span>
}

// ============================================
// TASK TYPE ICON
// ============================================

interface TaskTypeIconProps {
  task: Task
}

const TaskTypeIcon: FC<TaskTypeIconProps> = ({ task }) => {
  if (!task.taskType || task.taskType === 'task') return null

  const typeConfig = TASK_TYPES_BY_ID[task.taskType]
  if (!typeConfig) return null

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (task.url) {
      window.open(task.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <span
      className={`task-type-icon ${task.url ? 'has-url' : ''}`}
      onClick={task.url ? handleClick : undefined}
      title={task.url ? `Open ${typeConfig.name}` : typeConfig.name}
    >
      {typeConfig.icon}
    </span>
  )
}

// ============================================
// BLOCKED BADGE
// ============================================

interface BlockedBadgeProps {
  task: Task
  allTasks?: Task[]
  onUnblock?: () => void
}

const BlockedBadge: FC<BlockedBadgeProps> = ({ task, allTasks, onUnblock }) => {
  if (!task.blockedBy) return null

  let reason: string
  if (task.blockedBy.type === 'text') {
    reason = task.blockedBy.reason
  } else {
    const blockerTask = allTasks?.find(t => task.blockedBy?.type === 'task' && task.blockedBy.taskId === t.id)
    reason = blockerTask ? blockerTask.title : 'Waiting for task'
  }

  return (
    <div className="blocked-badge" title={reason}>
      <span>{reason.length > 30 ? `${reason.slice(0, 30)}...` : reason}</span>
      {onUnblock && (
        <button
          className="unblock-btn"
          onClick={(e) => { e.stopPropagation(); onUnblock(); }}
          title="Unblock and move to Todo"
        >
          Unblock
        </button>
      )}
    </div>
  )
}

// ============================================
// SUBTASK PROGRESS BAR (for active cards)
// ============================================

const SubtaskProgressBar: FC<{ completed: number; total: number }> = ({ completed, total }) => {
  const pct = total > 0 ? (completed / total) * 100 : 0
  const isComplete = completed === total && total > 0

  return (
    <div className="subtask-progress-bar-wrapper">
      <div className="subtask-progress-bar">
        <div
          className={`subtask-progress-fill ${isComplete ? 'complete' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`subtask-progress-text ${isComplete ? 'complete' : ''}`}>
        {completed}/{total}
      </span>
    </div>
  )
}

// ============================================
// TASK CARD
// ============================================

interface TaskCardProps {
  task: Task
  activeFilter: TagId | null
  allTasks?: Task[]
  onBlockTask?: (task: Task) => void
  variant?: 'active' | 'compact'
}

export const TaskCard: FC<TaskCardProps> = ({
  task,
  activeFilter,
  allTasks,
  onBlockTask,
  variant = 'compact',
}) => {
  const [expanded, setExpanded] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(task.title)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionValue, setDescriptionValue] = useState(task.description || '')
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const subtaskInputRef = useRef<HTMLInputElement>(null)

  const { mutate: toggleSubtask } = useToggleSubtask()
  const { mutate: unblockTask } = useUnblockTask()
  const { mutate: updateTask } = useUpdateTask()
  const { mutate: addSubtask } = useAddSubtask()
  const { mutate: deleteSubtask } = useDeleteSubtask()
  const { mutate: moveTask } = useMoveTask()
  const { ageState, daysSinceCreation } = useTaskAge(task)

  // dnd-kit sortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const hasSubtasks = task.subtasks.length > 0
  const completedSubtasks = task.subtasks.filter(st => st.completed).length
  const isFilteredOut = activeFilter !== null && !task.tags.includes(activeFilter)
  const isActive = variant === 'active'

  // Sync values when task changes
  useEffect(() => {
    setTitleValue(task.title)
  }, [task.title])

  useEffect(() => {
    setDescriptionValue(task.description || '')
  }, [task.description])

  // Focus inputs when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  useEffect(() => {
    if (isEditingDescription && descriptionRef.current) {
      descriptionRef.current.focus()
      descriptionRef.current.select()
    }
  }, [isEditingDescription])

  const handleCardClick = () => {
    if (!isEditingTitle) {
      setExpanded(prev => !prev)
    }
  }

  const handleStatusChange = (newColumnId: ColumnId) => {
    moveTask({ taskId: task.id, targetColumnId: newColumnId, targetIndex: 0 })
  }

  const handlePriorityChange = (newPriority: Priority) => {
    updateTask({ ...task, priority: newPriority })
  }

  const handleTagsChange = (newTags: TagId[]) => {
    updateTask({ ...task, tags: newTags })
  }

  // --- Title editing ---
  const handleTitleClick = (e: MouseEvent) => {
    e.stopPropagation()
    setIsEditingTitle(true)
  }

  const handleTitleBlur = () => {
    setIsEditingTitle(false)
    const newTitle = titleValue.trim()
    if (newTitle && newTitle !== task.title) {
      updateTask({ ...task, title: newTitle })
    } else {
      setTitleValue(task.title)
    }
  }

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setTitleValue(task.title)
      setIsEditingTitle(false)
    } else if (e.key === 'Enter') {
      titleInputRef.current?.blur()
    }
  }

  // --- Description editing ---
  const handleDescriptionClick = (e: MouseEvent) => {
    e.stopPropagation()
    setIsEditingDescription(true)
  }

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false)
    const newDescription = descriptionValue.trim() || null
    if (newDescription !== task.description) {
      updateTask({ ...task, description: newDescription })
    }
  }

  const handleDescriptionKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setDescriptionValue(task.description || '')
      setIsEditingDescription(false)
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      descriptionRef.current?.blur()
    }
  }

  // --- Subtasks ---
  const handleSubtaskToggle = (subtaskId: string) => {
    toggleSubtask({ task, subtaskId })
  }

  const handleSubtaskDelete = (subtaskId: string) => {
    deleteSubtask({ task, subtaskId })
  }

  const handleBlockClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (onBlockTask && task.columnId !== 'blocked' && task.columnId !== 'done') {
      onBlockTask(task)
    }
  }

  const handleAddSubtask = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation()
    if (newSubtaskText.trim()) {
      addSubtask({ task, text: newSubtaskText.trim() })
      setNewSubtaskText('')
      subtaskInputRef.current?.focus()
    }
  }

  const handleSubtaskKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddSubtask(e)
    } else if (e.key === 'Escape') {
      setNewSubtaskText('')
    }
  }

  // Build class names
  const classNames = [
    'task-card',
    `priority-${task.priority}`,
    `variant-${variant}`,
    expanded ? 'expanded' : '',
    isDragging ? 'dragging' : '',
    isFilteredOut ? 'filtered-out' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // ============================================
  // ACTIVE CARD (Doing / Blocked zone)
  // ============================================
  if (isActive) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={classNames}
        data-task-id={task.id}
        data-age={ageState}
        data-tags={task.tags.join(',')}
        {...attributes}
        {...listeners}
      >
        {/* Blocked badge at the top */}
        {task.blockedBy && (
          <BlockedBadge
            task={task}
            allTasks={allTasks}
            onUnblock={() => unblockTask(task.id)}
          />
        )}

        <div className="task-header">
          <div className="task-title-row">
            <StatusCircle columnId={task.columnId} onChange={handleStatusChange} size={18} />
            <TaskTypeIcon task={task} />
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                className="task-title-input"
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="task-title" onClick={handleTitleClick}>
                {task.title}
              </span>
            )}
          </div>
        </div>

        {/* Always-visible milestones */}
        <div className="active-milestones" onClick={e => e.stopPropagation()}>
          {task.subtasks.map(st => (
            <label
              key={st.id}
              className={`milestone-item ${st.completed ? 'completed' : ''}`}
              onClick={e => e.stopPropagation()}
            >
              <input
                type="checkbox"
                className="subtask-checkbox"
                checked={st.completed}
                onChange={() => handleSubtaskToggle(st.id)}
              />
              <span className="milestone-text">{st.text}</span>
              <button
                className="milestone-delete"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleSubtaskDelete(st.id) }}
                title="Remove milestone"
              >
                &times;
              </button>
            </label>
          ))}
          <div className="milestone-add">
            <input
              ref={subtaskInputRef}
              type="text"
              className="milestone-add-input"
              value={newSubtaskText}
              onChange={e => setNewSubtaskText(e.target.value)}
              onKeyDown={handleSubtaskKeyDown}
              placeholder="+ Add milestone..."
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Progress bar */}
        {hasSubtasks && (
          <SubtaskProgressBar completed={completedSubtasks} total={task.subtasks.length} />
        )}

        {/* Meta row: priority, tags, actions */}
        <div className="task-footer">
          <div className="task-footer-left">
            <PriorityPill priority={task.priority} onChange={handlePriorityChange} />
            <TagEditor tags={task.tags} onChange={handleTagsChange} />
            {daysSinceCreation > 3 && (
              <span className="age-badge">{daysSinceCreation}d</span>
            )}
            {task.recurrence && <RecurringBadge recurrence={task.recurrence} />}
            <DueDateBadge dueDate={task.dueDate} />
          </div>
          <div className="task-actions">
            {onBlockTask && task.columnId !== 'blocked' && task.columnId !== 'done' && (
              <button className="task-action-btn" onClick={handleBlockClick} title="Block this task">
                Block
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // COMPACT CARD (Todo / Inbox sidebar)
  // ============================================
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames}
      data-task-id={task.id}
      data-age={ageState}
      data-tags={task.tags.join(',')}
      onClick={handleCardClick}
      {...attributes}
      {...listeners}
    >
      <div className="task-header">
        <div className="task-title-row">
          <StatusCircle columnId={task.columnId} onChange={handleStatusChange} size={14} />
          <TaskTypeIcon task={task} />
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              className="task-title-input"
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="task-title" onClick={handleTitleClick}>
              {task.title}
            </span>
          )}
        </div>
        <div className="task-meta">
          <PriorityPill priority={task.priority} onChange={handlePriorityChange} />
          {hasSubtasks && (
            <ProgressChip completed={completedSubtasks} total={task.subtasks.length} />
          )}
          {daysSinceCreation > 3 && (
            <span className="age-badge">{daysSinceCreation}d</span>
          )}
          <DueDateBadge dueDate={task.dueDate} />
          <TagEditor tags={task.tags} onChange={handleTagsChange} />
        </div>
      </div>

      {/* Expanded content for compact cards too */}
      {expanded && (
        <div className="task-expanded-content" onClick={e => e.stopPropagation()}>
          <div className="task-description-section">
            {isEditingDescription ? (
              <textarea
                ref={descriptionRef}
                className="task-description-input"
                value={descriptionValue}
                onChange={e => setDescriptionValue(e.target.value)}
                onBlur={handleDescriptionBlur}
                onKeyDown={handleDescriptionKeyDown}
                placeholder="Add a description..."
              />
            ) : (
              <div
                className={`task-description ${!task.description ? 'empty' : ''}`}
                onClick={handleDescriptionClick}
              >
                {task.description || 'Add a description...'}
              </div>
            )}
          </div>

          {hasSubtasks && (
            <SubtasksContainer subtasks={task.subtasks} onToggle={handleSubtaskToggle} />
          )}

          <div className="add-subtask-section">
            <input
              ref={subtaskInputRef}
              type="text"
              className="add-subtask-input"
              value={newSubtaskText}
              onChange={e => setNewSubtaskText(e.target.value)}
              onKeyDown={handleSubtaskKeyDown}
              placeholder="+ Add subtask..."
              onClick={e => e.stopPropagation()}
            />
            {newSubtaskText.trim() && (
              <button type="button" className="add-subtask-btn" onClick={handleAddSubtask}>
                Add
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
