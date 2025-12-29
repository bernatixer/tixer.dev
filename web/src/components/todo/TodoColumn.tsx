// ============================================
// TODO COLUMN COMPONENT
// ============================================

import { FC } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, Column, TagId } from '@/todo/types'
import { TaskCard } from './TaskCard'

interface TodoColumnProps {
  column: Column
  tasks: Task[]
  activeFilter: TagId | null
  onTagClick: (tagId: TagId) => void
  onAddTask: () => void
}

export const TodoColumn: FC<TodoColumnProps> = ({
  column,
  tasks,
  activeFilter,
  onTagClick,
  onAddTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      columnId: column.id,
    },
  })

  const taskIds = tasks.map(task => task.id)

  // Build column class names exactly as original
  const columnClassName = [
    'todo-column',
    `column-${column.id}`,
    isOver ? 'drag-over' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={columnClassName} data-column={column.id}>
      <div className="column-header">
        <h2 className="column-title">{column.title}</h2>
        <span className="column-count">{tasks.length.toLocaleString()}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`column-tasks ${isOver ? 'drag-over' : ''}`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              activeFilter={activeFilter}
              onTagClick={onTagClick}
            />
          ))}
        </SortableContext>
        <button className="add-task-inline" onClick={onAddTask}>
          Add task
        </button>
      </div>
    </div>
  )
}

