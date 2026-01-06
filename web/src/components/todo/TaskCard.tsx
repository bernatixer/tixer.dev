// ============================================
// TASK CARD COMPONENT
// ============================================

import { FC, useState, MouseEvent, useRef, useEffect, KeyboardEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TagId } from '@/todo/types'
import { TAGS_BY_ID, TASK_TYPES_BY_ID } from '@/todo/types'
import { useTaskAge } from '@/hooks/useAppState'
import { useToggleSubtask, useUnblockTask, useUpdateTask, useAddSubtask } from '@/hooks/useTasks'
import { DueDateBadge } from './DueDateBadge'
import { SubtasksContainer, ProgressChip } from './Subtasks'

// ============================================
// TAG BADGE
// ============================================

interface TagBadgeProps {
  tagId: TagId
  onClick: (tagId: TagId, e: MouseEvent) => void
}

const TagBadge: FC<TagBadgeProps> = ({ tagId, onClick }) => {
  const tag = TAGS_BY_ID[tagId]

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    onClick(tagId, e)
  }

  return (
    <span className={`task-tag tag-${tagId}`} data-tag={tagId} onClick={handleClick}>
      {tag.name}
    </span>
  )
}

// ============================================
// TAG DOTS (for compact mode)
// ============================================

interface TagDotsProps {
  tags: TagId[]
}

const TagDots: FC<TagDotsProps> = ({ tags }) => {
  return (
    <div className="tag-dots">
      {tags.map(tagId => (
        <span key={tagId} className={`tag-dot dot-${tagId}`} />
      ))}
    </div>
  )
}

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
  // Don't show icon for regular tasks
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
// TASK CARD
// ============================================

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
    reason = blockerTask ? `⏳ ${blockerTask.title}` : '⏳ Waiting for task'
  }

  return (
    <div className="blocked-badge" title={reason}>
      <span>🚧 {reason.length > 20 ? `${reason.slice(0, 20)}...` : reason}</span>
      {onUnblock && (
        <button 
          className="unblock-btn" 
          onClick={(e) => { e.stopPropagation(); onUnblock(); }}
          title="Unblock and move to Todo"
        >
          ✓
        </button>
      )}
    </div>
  )
}

interface TaskCardProps {
  task: Task
  activeFilter: TagId | null
  onTagClick: (tagId: TagId) => void
  allTasks?: Task[]
  onBlockTask?: (task: Task) => void
}

export const TaskCard: FC<TaskCardProps> = ({ task, activeFilter, onTagClick, allTasks, onBlockTask }) => {
  const [expanded, setExpanded] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionValue, setDescriptionValue] = useState(task.description || '')
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const subtaskInputRef = useRef<HTMLInputElement>(null)

  const { mutate: toggleSubtask } = useToggleSubtask()
  const { mutate: unblockTask } = useUnblockTask()
  const { mutate: updateTask } = useUpdateTask()
  const { mutate: addSubtask } = useAddSubtask()
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

  // Check if filtered out
  const isFilteredOut = activeFilter !== null && !task.tags.includes(activeFilter)

  // Sync description value when task changes
  useEffect(() => {
    setDescriptionValue(task.description || '')
  }, [task.description])

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditingDescription && descriptionRef.current) {
      descriptionRef.current.focus()
      descriptionRef.current.select()
    }
  }, [isEditingDescription])

  const handleCardClick = () => {
    setExpanded(prev => !prev)
  }

  const handleSubtaskToggle = (subtaskId: string) => {
    toggleSubtask({ task, subtaskId })
  }

  const handleTagClick = (tagId: TagId, e: MouseEvent) => {
    e.stopPropagation()
    onTagClick(tagId)
  }

  const handleBlockClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (onBlockTask && task.columnId !== 'blocked' && task.columnId !== 'done') {
      onBlockTask(task)
    }
  }

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
      // Enter saves, Shift+Enter adds new line
      e.preventDefault()
      descriptionRef.current?.blur()
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

  // Build class names - all cards are expandable
  const classNames = [
    'task-card',
    `priority-${task.priority}`,
    'expandable',
    expanded ? 'expanded' : '',
    isDragging ? 'dragging' : '',
    isFilteredOut ? 'filtered-out' : '',
  ]
    .filter(Boolean)
    .join(' ')

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
      {task.blockedBy && (
        <BlockedBadge 
          task={task} 
          allTasks={allTasks} 
          onUnblock={() => unblockTask(task.id)}
        />
      )}
      <div className="task-header">
        <div className="task-title">
          <TaskTypeIcon task={task} />
          <span>{task.title}</span>
        </div>
        <div className="task-meta">
          {hasSubtasks && (
            <ProgressChip completed={completedSubtasks} total={task.subtasks.length} />
          )}
          {daysSinceCreation > 3 ? (
            <span className="age-badge">{daysSinceCreation}d</span>
          ) : (
            <span className="age-badge"></span>
          )}
          {task.recurrence && <RecurringBadge recurrence={task.recurrence} />}
          <DueDateBadge dueDate={task.dueDate} />
          <TagDots tags={task.tags} />
        </div>
      </div>

      <div className="task-footer">
        <div className="task-tags">
          {task.tags.map(tagId => (
            <TagBadge key={tagId} tagId={tagId} onClick={handleTagClick} />
          ))}
        </div>
        {onBlockTask && task.columnId !== 'blocked' && task.columnId !== 'done' && (
          <button
            className="task-action-btn"
            onClick={handleBlockClick}
            title="Block this task"
          >
            🚧
          </button>
        )}
      </div>

      {/* Expanded content: description + subtasks + add subtask */}
      {expanded && (
        <div className="task-expanded-content" onClick={e => e.stopPropagation()}>
          {/* Description */}
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

          {/* Subtasks */}
          {hasSubtasks && (
            <SubtasksContainer subtasks={task.subtasks} onToggle={handleSubtaskToggle} />
          )}

          {/* Add subtask input */}
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
              <button
                type="button"
                className="add-subtask-btn"
                onClick={handleAddSubtask}
              >
                Add
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

