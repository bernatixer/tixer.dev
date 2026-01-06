// ============================================
// TODO BOARD COMPONENT
// ============================================

import { FC, useCallback, useState, useMemo, useEffect, useRef } from 'react'
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
import type { Task, ColumnId, TagId } from '@/todo/types'
import { COLUMNS } from '@/todo/types'
import { useTasks, useMoveTask } from '@/hooks/useTasks'
import { TodoColumn } from './TodoColumn'
import { TaskCard } from './TaskCard'

interface PendingMove {
  taskId: string
  targetColumnId: ColumnId
  targetIndex: number
}

interface TodoBoardProps {
  activeFilter: TagId | null
  onTagClick: (tagId: TagId) => void
  onAddTask: (columnId: ColumnId) => void
  onBlockTask: (task: Task) => void
}

export const TodoBoard: FC<TodoBoardProps> = ({
  activeFilter,
  onTagClick,
  onAddTask,
  onBlockTask,
}) => {
  const { data: tasks = [] } = useTasks()
  const { mutate: moveTask } = useMoveTask()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const isDropping = useRef(false)

  // Clear pending move once the optimistic update has been applied to tasks
  useEffect(() => {
    if (isDropping.current && pendingMove) {
      // Check if the task is now in the expected position in the actual tasks
      const task = tasks.find(t => t.id === pendingMove.taskId)
      if (task && task.columnId === pendingMove.targetColumnId) {
        setPendingMove(null)
        isDropping.current = false
      }
    }
  }, [tasks, pendingMove])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Apply pending move to tasks for visual preview during drag
  const displayTasks = useMemo(() => {
    if (!pendingMove) return tasks

    const task = tasks.find(t => t.id === pendingMove.taskId)
    if (!task) return tasks

    // Remove task from its current position
    const withoutTask = tasks.filter(t => t.id !== pendingMove.taskId)

    // Get tasks in target column
    const targetColumnTasks = withoutTask.filter(
      t => t.columnId === pendingMove.targetColumnId
    )
    const otherTasks = withoutTask.filter(
      t => t.columnId !== pendingMove.targetColumnId
    )

    // Insert task at target position
    const updatedTask = { ...task, columnId: pendingMove.targetColumnId }
    targetColumnTasks.splice(pendingMove.targetIndex, 0, updatedTask)

    return [...otherTasks, ...targetColumnTasks]
  }, [tasks, pendingMove])

  const getTasksByColumn = useCallback(
    (columnId: ColumnId) => displayTasks.filter(task => task.columnId === columnId),
    [displayTasks]
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

    const draggedTask = tasks.find(t => t.id === activeId)
    if (!draggedTask) return

    // Check if we're over a column
    const overColumn = COLUMNS.find(c => c.id === overId)
    if (overColumn) {
      const targetColumnTasks = displayTasks.filter(
        t => t.columnId === overColumn.id && t.id !== activeId
      )
      setPendingMove({
        taskId: activeId,
        targetColumnId: overColumn.id,
        targetIndex: targetColumnTasks.length,
      })
      return
    }

    // Check if we're over a task
    const overTask = tasks.find(t => t.id === overId)
    if (overTask && draggedTask.id !== overTask.id) {
      const targetColumnTasks = displayTasks.filter(
        t => t.columnId === overTask.columnId && t.id !== activeId
      )
      const overIndex = targetColumnTasks.findIndex(t => t.id === overId)

      setPendingMove({
        taskId: activeId,
        targetColumnId: overTask.columnId,
        targetIndex: overIndex >= 0 ? overIndex : targetColumnTasks.length,
      })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event
    
    setActiveTask(null)
    
    // Only call API if we have a pending move
    if (pendingMove && over) {
      isDropping.current = true
      moveTask(pendingMove)
      // Don't clear pendingMove here - useEffect will clear it once the optimistic update applies
    } else {
      setPendingMove(null)
    }
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
        {COLUMNS
          .filter(column => {
            // Hide blocked column if it has no tasks
            if (column.id === 'blocked') {
              return getTasksByColumn('blocked').length > 0
            }
            return true
          })
          .map(column => (
            <TodoColumn
              key={column.id}
              column={column}
              tasks={getTasksByColumn(column.id)}
              allTasks={tasks}
              activeFilter={activeFilter}
              onTagClick={onTagClick}
              onAddTask={() => onAddTask(column.id)}
              onBlockTask={onBlockTask}
            />
          ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCard
            task={activeTask}
            activeFilter={activeFilter}
            onTagClick={onTagClick}
            allTasks={tasks}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

