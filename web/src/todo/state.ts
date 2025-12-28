// ============================================
// TODO APP STATE MANAGEMENT
// ============================================

import type { 
  Task, 
  AppState, 
  ColumnId, 
  TagId, 
  AgeState,
  TaskCreate,
  TaskUpdate,
  MoveTaskParams
} from './types'
import { COLUMNS, AGE_THRESHOLDS } from './types'
import { getMockTasks } from './mock-data'

// ============================================
// STATE
// ============================================

let state: AppState = {
  tasks: [],
  columns: [...COLUMNS],
  activeFilter: null,
  focusMode: false,
  compactMode: false,
}

// ============================================
// EVENT SYSTEM
// ============================================

type EventType = 
  | 'tasksChanged'
  | 'filterChanged'
  | 'focusModeChanged'
  | 'compactModeChanged'
  | 'taskMoved'

type EventCallback = () => void

const listeners: Map<EventType, Set<EventCallback>> = new Map()

export function subscribe(event: EventType, callback: EventCallback): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set())
  }
  listeners.get(event)!.add(callback)
  
  // Return unsubscribe function
  return () => {
    listeners.get(event)?.delete(callback)
  }
}

function emit(event: EventType): void {
  listeners.get(event)?.forEach(callback => callback())
}

// ============================================
// GETTERS
// ============================================

export function getState(): Readonly<AppState> {
  return state
}

export function getTasks(): readonly Task[] {
  return state.tasks
}

export function getTasksByColumn(columnId: ColumnId): Task[] {
  return state.tasks.filter(task => task.columnId === columnId)
}

export function getTaskById(id: string): Task | undefined {
  return state.tasks.find(task => task.id === id)
}

export function getActiveFilter(): TagId | null {
  return state.activeFilter
}

export function isFocusMode(): boolean {
  return state.focusMode
}

export function isCompactMode(): boolean {
  return state.compactMode
}

// ============================================
// TASK ACTIONS
// ============================================

export function addTask(taskData: TaskCreate): Task {
  const task: Task = {
    ...taskData,
    id: generateId(),
    createdAt: new Date(),
  }
  
  state.tasks = [...state.tasks, task]
  emit('tasksChanged')
  return task
}

export function updateTask(id: string, updates: TaskUpdate): Task | undefined {
  const index = state.tasks.findIndex(t => t.id === id)
  if (index === -1) return undefined
  
  const updatedTask = { ...state.tasks[index], ...updates }
  state.tasks = [
    ...state.tasks.slice(0, index),
    updatedTask,
    ...state.tasks.slice(index + 1),
  ]
  
  emit('tasksChanged')
  return updatedTask
}

export function deleteTask(id: string): boolean {
  const initialLength = state.tasks.length
  state.tasks = state.tasks.filter(t => t.id !== id)
  
  if (state.tasks.length !== initialLength) {
    emit('tasksChanged')
    return true
  }
  return false
}

export function moveTask({ taskId, targetColumnId, targetIndex }: MoveTaskParams): void {
  const task = getTaskById(taskId)
  if (!task) return
  
  const sourceColumnId = task.columnId
  
  // Remove from current position
  const otherTasks = state.tasks.filter(t => t.id !== taskId)
  
  // Get tasks in target column
  const targetColumnTasks = otherTasks.filter(t => t.columnId === targetColumnId)
  const otherColumnTasks = otherTasks.filter(t => t.columnId !== targetColumnId)
  
  // Insert at target position
  const updatedTask = { ...task, columnId: targetColumnId }
  targetColumnTasks.splice(targetIndex, 0, updatedTask)
  
  // Rebuild tasks array maintaining column order
  state.tasks = [...otherColumnTasks, ...targetColumnTasks]
  
  emit('tasksChanged')
  emit('taskMoved')
  
  // Handle recurring task regeneration when moved to done
  if (targetColumnId === 'done' && sourceColumnId !== 'done' && task.recurrence) {
    regenerateRecurringTask(task)
  }
}

// ============================================
// SUBTASK ACTIONS
// ============================================

export function toggleSubtask(taskId: string, subtaskId: string): void {
  const task = getTaskById(taskId)
  if (!task) return
  
  const updatedSubtasks = task.subtasks.map(st => 
    st.id === subtaskId ? { ...st, completed: !st.completed } : st
  )
  
  updateTask(taskId, { subtasks: updatedSubtasks })
}

export function addSubtask(taskId: string, text: string): void {
  const task = getTaskById(taskId)
  if (!task) return
  
  const newSubtask = {
    id: generateId(),
    text,
    completed: false,
  }
  
  updateTask(taskId, { subtasks: [...task.subtasks, newSubtask] })
}

// ============================================
// FILTER ACTIONS
// ============================================

export function setFilter(tagId: TagId | null): void {
  state.activeFilter = tagId
  emit('filterChanged')
}

export function toggleFilter(tagId: TagId): void {
  state.activeFilter = state.activeFilter === tagId ? null : tagId
  emit('filterChanged')
}

export function clearFilter(): void {
  state.activeFilter = null
  emit('filterChanged')
}

// ============================================
// MODE ACTIONS
// ============================================

export function toggleFocusMode(): void {
  state.focusMode = !state.focusMode
  emit('focusModeChanged')
}

export function setFocusMode(enabled: boolean): void {
  state.focusMode = enabled
  emit('focusModeChanged')
}

export function toggleCompactMode(): void {
  state.compactMode = !state.compactMode
  emit('compactModeChanged')
}

export function setCompactMode(enabled: boolean): void {
  state.compactMode = enabled
  emit('compactModeChanged')
}

// ============================================
// RECURRING TASKS
// ============================================

function regenerateRecurringTask(completedTask: Task): void {
  if (!completedTask.recurrence || !completedTask.dueDate) return
  
  const nextDueDate = new Date(completedTask.dueDate)
  
  switch (completedTask.recurrence) {
    case 'daily':
      nextDueDate.setDate(nextDueDate.getDate() + 1)
      break
    case 'weekly':
      nextDueDate.setDate(nextDueDate.getDate() + 7)
      break
    case 'monthly':
      nextDueDate.setMonth(nextDueDate.getMonth() + 1)
      break
    case 'yearly':
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1)
      break
  }
  
  // Create new task in todo column
  addTask({
    title: completedTask.title,
    priority: completedTask.priority,
    columnId: 'todo',
    tags: [...completedTask.tags],
    dueDate: nextDueDate,
    recurrence: completedTask.recurrence,
    subtasks: completedTask.subtasks.map(st => ({
      ...st,
      id: generateId(),
      completed: false,
    })),
  })
}

// ============================================
// AGING CALCULATIONS
// ============================================

export function calculateAge(task: Task): AgeState {
  // Only apply aging to inbox and todo columns
  if (task.columnId !== 'inbox' && task.columnId !== 'todo') {
    return 'fresh'
  }
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const createdDate = new Date(task.createdAt)
  createdDate.setHours(0, 0, 0, 0)
  
  const daysSinceCreation = Math.floor(
    (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  
  for (const threshold of AGE_THRESHOLDS) {
    if (
      daysSinceCreation >= threshold.minDays &&
      (threshold.maxDays === null || daysSinceCreation <= threshold.maxDays)
    ) {
      return threshold.state
    }
  }
  
  return 'fresh'
}

export function getDaysSinceCreation(task: Task): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const createdDate = new Date(task.createdAt)
  createdDate.setHours(0, 0, 0, 0)
  
  return Math.floor(
    (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  )
}

// ============================================
// INITIALIZATION
// ============================================

export function initializeState(): void {
  state.tasks = getMockTasks()
  emit('tasksChanged')
}

// ============================================
// UTILITIES
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

