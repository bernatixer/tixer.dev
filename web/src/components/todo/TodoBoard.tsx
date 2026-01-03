// ============================================
// TODO BOARD COMPONENT
// ============================================

import { FC, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { useState } from 'react'
import type { Task, ColumnId, TagId } from '@/todo/types'
import { COLUMNS } from '@/todo/types'
import { useTasks, useMoveTask } from '@/hooks/useTasks'
import { TodoColumn } from './TodoColumn'
import { TaskCard } from './TaskCard'

interface TodoBoardProps {
  activeFilter: TagId | null
  onTagClick: (tagId: TagId) => void
  onAddTask: (columnId: ColumnId) => void
}

export const TodoBoard: FC<TodoBoardProps> = ({
  activeFilter,
  onTagClick,
  onAddTask,
}) => {
  const { data: tasks = [] } = useTasks()
  const { mutate: moveTask } = useMoveTask()
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const getTasksByColumn = useCallback(
    (columnId: ColumnId) => tasks.filter(task => task.columnId === columnId),
    [tasks]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const task = tasks.find(t => t.id === active.id)
    if (task) {
      setActiveTask(task)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeTask = tasks.find(t => t.id === activeId)
    if (!activeTask) return

    // Check if we're over a column
    const overColumn = COLUMNS.find(c => c.id === overId)
    if (overColumn && activeTask.columnId !== overColumn.id) {
      // Move to new column
      const targetColumnTasks = getTasksByColumn(overColumn.id)
      moveTask({
        taskId: activeId,
        targetColumnId: overColumn.id,
        targetIndex: targetColumnTasks.length,
      })
      return
    }

    // Check if we're over a task
    const overTask = tasks.find(t => t.id === overId)
    if (overTask && activeTask.id !== overTask.id) {
      const targetColumnTasks = getTasksByColumn(overTask.columnId)
      const overIndex = targetColumnTasks.findIndex(t => t.id === overId)
      const activeIndex = targetColumnTasks.findIndex(t => t.id === activeId)

      // Move between columns or reorder within same column
      if (activeTask.columnId !== overTask.columnId || activeIndex !== overIndex) {
        moveTask({
          taskId: activeId,
          targetColumnId: overTask.columnId,
          targetIndex: overIndex,
        })
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null)

    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeTask = tasks.find(t => t.id === activeId)
    if (!activeTask) return

    // Determine target column
    let targetColumnId: ColumnId = activeTask.columnId
    let targetIndex = 0

    // Check if dropped on a column
    const overColumn = COLUMNS.find(c => c.id === overId)
    if (overColumn) {
      targetColumnId = overColumn.id
      const columnTasks = getTasksByColumn(overColumn.id)
      targetIndex = columnTasks.length
    } else {
      // Dropped on a task
      const overTask = tasks.find(t => t.id === overId)
      if (overTask) {
        targetColumnId = overTask.columnId
        const columnTasks = getTasksByColumn(overTask.columnId)
        targetIndex = columnTasks.findIndex(t => t.id === overId)
      }
    }

    moveTask({
      taskId: activeId,
      targetColumnId,
      targetIndex,
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="todo-board">
        {COLUMNS.map(column => (
          <TodoColumn
            key={column.id}
            column={column}
            tasks={getTasksByColumn(column.id)}
            activeFilter={activeFilter}
            onTagClick={onTagClick}
            onAddTask={() => onAddTask(column.id)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCard
            task={activeTask}
            activeFilter={activeFilter}
            onTagClick={onTagClick}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

