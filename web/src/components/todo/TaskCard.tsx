// ============================================
// TASK CARD COMPONENT
// ============================================

import { FC, useState, MouseEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TagId } from '@/todo/types'
import { TAGS_BY_ID, TASK_TYPES_BY_ID } from '@/todo/types'
import { useTaskAge } from '@/hooks/useAppState'
import { useToggleSubtask, useUnblockTask } from '@/hooks/useTasks'
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
  const { mutate: toggleSubtask } = useToggleSubtask()
  const { mutate: unblockTask } = useUnblockTask()
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

  const handleCardClick = () => {
    if (hasSubtasks) {
      setExpanded(prev => !prev)
    }
  }

  const handleSubtaskToggle = (subtaskId: string) => {
    toggleSubtask({ taskId: task.id, subtaskId })
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

  // Build class names exactly as in original
  const classNames = [
    'task-card',
    `priority-${task.priority}`,
    hasSubtasks ? 'has-subtasks' : '',
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

      {hasSubtasks && (
        <SubtasksContainer subtasks={task.subtasks} onToggle={handleSubtaskToggle} />
      )}
    </div>
  )
}

