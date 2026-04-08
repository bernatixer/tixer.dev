// ============================================
// TODO BOARD COMPONENT - Two-zone layout
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
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import type { Task, ColumnId, TagConfig, TagId } from '@/todo/types'
import { COLUMNS } from '@/todo/types'
import { useTasks, useMoveTask } from '@/hooks/useTasks'
import { TaskCard } from './TaskCard'

interface PendingMove {
  taskId: string
  targetColumnId: ColumnId
  targetIndex: number
}

interface TodoBoardProps {
  activeFilter: TagId | null
  availableTags: TagConfig[]
  onAddTask: (columnId: ColumnId) => void
  onBlockTask: (task: Task) => void
}

// ============================================
// DROPPABLE ZONE
// ============================================

const DroppableZone: FC<{ id: string; children: React.ReactNode; className?: string }> = ({
  id, children, className = '',
}) => {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'column', columnId: id } })
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'drag-over' : ''}`}>
      {children}
    </div>
  )
}

// ============================================
// SIDEBAR SECTION (Todo / Inbox)
// ============================================

interface SidebarSectionProps {
  columnId: ColumnId
  title: string
  tasks: Task[]
  allTasks: Task[]
  activeFilter: TagId | null
  availableTags: TagConfig[]
  onBlockTask: (task: Task) => void
  onAddTask: () => void
}

const SidebarSection: FC<SidebarSectionProps> = ({
  columnId, title, tasks, allTasks, activeFilter, availableTags, onBlockTask, onAddTask,
}) => {
  const taskIds = tasks.map(t => t.id)

  return (
    <div className={`sidebar-section section-${columnId}`}>
      <div className="sidebar-section-header">
        <h3 className="sidebar-section-title">{title}</h3>
        <span className="sidebar-section-count">{tasks.length}</span>
      </div>
      <DroppableZone id={columnId} className="sidebar-section-tasks">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              activeFilter={activeFilter}
              availableTags={availableTags}
              allTasks={allTasks}
              onBlockTask={onBlockTask}
              variant="compact"
            />
          ))}
        </SortableContext>
        <button className="add-task-inline" onClick={onAddTask}>
          Add task
        </button>
      </DroppableZone>
    </div>
  )
}

// ============================================
// MAIN BOARD
// ============================================

export const TodoBoard: FC<TodoBoardProps> = ({
  activeFilter,
  availableTags,
  onAddTask,
  onBlockTask,
}) => {
  const { data: tasks = [] } = useTasks()
  const { mutate: moveTask } = useMoveTask()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const isDropping = useRef(false)

  // Clear pending move once the optimistic update has been applied
  useEffect(() => {
    if (isDropping.current && pendingMove) {
      const task = tasks.find(t => t.id === pendingMove.taskId)
      if (task && task.columnId === pendingMove.targetColumnId) {
        setPendingMove(null)
        isDropping.current = false
      }
    }
  }, [tasks, pendingMove])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  // Apply pending move for visual preview during drag
  const displayTasks = useMemo(() => {
    if (!pendingMove) return tasks

    const task = tasks.find(t => t.id === pendingMove.taskId)
    if (!task) return tasks

    const withoutTask = tasks.filter(t => t.id !== pendingMove.taskId)
    const targetColumnTasks = withoutTask.filter(t => t.columnId === pendingMove.targetColumnId)
    const otherTasks = withoutTask.filter(t => t.columnId !== pendingMove.targetColumnId)
    const updatedTask = { ...task, columnId: pendingMove.targetColumnId }
    targetColumnTasks.splice(pendingMove.targetIndex, 0, updatedTask)

    return [...otherTasks, ...targetColumnTasks]
  }, [tasks, pendingMove])

  const getTasksByColumn = useCallback(
    (columnId: ColumnId) => displayTasks.filter(task => task.columnId === columnId),
    [displayTasks]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    const draggedTask = tasks.find(t => t.id === activeId)
    if (!draggedTask) return

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

    if (pendingMove && over) {
      isDropping.current = true
      moveTask(pendingMove)
    } else {
      setPendingMove(null)
    }
  }

  // Get tasks for each zone
  const doingTasks = getTasksByColumn('doing')
  const blockedTasks = getTasksByColumn('blocked')
  const todoTasks = getTasksByColumn('todo')
  const inboxTasks = getTasksByColumn('inbox')
  const doingIds = doingTasks.map(t => t.id)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="todo-board-v2">
        {/* ===== MAIN ZONE: Active work ===== */}
        <div className="main-zone">
          {/* Doing section */}
          {doingTasks.length > 0 && (
            <div className="active-section section-doing">
              <div className="active-section-header">
                <h2 className="active-section-title">In Progress</h2>
                <span className="active-section-count">{doingTasks.length}</span>
              </div>
              <DroppableZone id="doing" className="active-section-tasks doing-grid">
                <SortableContext items={doingIds} strategy={rectSortingStrategy}>
                  {doingTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      activeFilter={activeFilter}
                      availableTags={availableTags}
                      allTasks={tasks}
                      onBlockTask={onBlockTask}
                      variant="active"
                    />
                  ))}
                </SortableContext>
              </DroppableZone>
            </div>
          )}

          {/* Empty state for main zone */}
          {doingTasks.length === 0 && (
            <DroppableZone id="doing" className="main-zone-empty">
              <div className="empty-state">
                <span className="empty-state-icon">&#9673;</span>
                <p>No tasks in progress</p>
                <p className="empty-state-hint">Drag a task here or change its status to start working</p>
              </div>
            </DroppableZone>
          )}
        </div>

        {/* ===== SIDEBAR: Queue ===== */}
        <div className="sidebar-zone">
          {blockedTasks.length > 0 && (
            <SidebarSection
              columnId="blocked"
              title="Blocked"
              tasks={blockedTasks}
              allTasks={tasks}
              activeFilter={activeFilter}
              availableTags={availableTags}
              onBlockTask={onBlockTask}
              onAddTask={() => {}}
            />
          )}
          <SidebarSection
            columnId="todo"
            title="Up Next"
            tasks={todoTasks}
            allTasks={tasks}
            activeFilter={activeFilter}
            availableTags={availableTags}
            onBlockTask={onBlockTask}
            onAddTask={() => onAddTask('todo')}
          />
          <SidebarSection
            columnId="inbox"
            title="Inbox"
            tasks={inboxTasks}
            allTasks={tasks}
            activeFilter={activeFilter}
            availableTags={availableTags}
            onBlockTask={onBlockTask}
            onAddTask={() => onAddTask('inbox')}
          />
        </div>
      </div>

      <DragOverlay>
        {activeTask && (
          <TaskCard
            task={activeTask}
            activeFilter={activeFilter}
            availableTags={availableTags}
            allTasks={tasks}
            variant="compact"
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
