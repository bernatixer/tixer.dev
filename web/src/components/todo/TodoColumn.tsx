// ============================================
// TODO COLUMN COMPONENT
// ============================================

import { FC, useState, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, Column, TagId } from '@/todo/types'
import { TaskCard } from './TaskCard'

const DONE_INITIAL_LIMIT = 10
const DONE_LOAD_MORE_COUNT = 10

interface TodoColumnProps {
  column: Column
  tasks: Task[]
  allTasks: Task[]
  activeFilter: TagId | null
  onTagClick: (tagId: TagId) => void
  onAddTask: () => void
  onBlockTask: (task: Task) => void
}

export const TodoColumn: FC<TodoColumnProps> = ({
  column,
  tasks,
  allTasks,
  activeFilter,
  onTagClick,
  onAddTask,
  onBlockTask,
}) => {
  const [doneLimit, setDoneLimit] = useState(DONE_INITIAL_LIMIT)
  
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      columnId: column.id,
    },
  })

  // For done column, sort by completion (most recent first) and limit display
  const displayTasks = useMemo(() => {
    if (column.id !== 'done') return tasks
    
    // Sort by updatedAt descending (most recently completed first)
    const sorted = [...tasks].sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return dateB - dateA
    })
    
    return sorted.slice(0, doneLimit)
  }, [tasks, column.id, doneLimit])

  const hasMoreDone = column.id === 'done' && tasks.length > doneLimit
  
  const handleLoadMore = () => {
    setDoneLimit(prev => prev + DONE_LOAD_MORE_COUNT)
  }

  const taskIds = displayTasks.map(task => task.id)

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
          {displayTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              activeFilter={activeFilter}
              onTagClick={onTagClick}
              allTasks={allTasks}
              onBlockTask={onBlockTask}
            />
          ))}
        </SortableContext>
        {hasMoreDone && (
          <button className="load-more-btn" onClick={handleLoadMore}>
            Load more ({tasks.length - doneLimit} remaining)
          </button>
        )}
        <button className="add-task-inline" onClick={onAddTask}>
          Add task
        </button>
      </div>
    </div>
  )
}

