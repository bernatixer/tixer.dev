// ============================================
// TODO APP TYPES
// ============================================

export type Priority = 'urgent' | 'high' | 'medium' | 'low'

export type ColumnId = 'inbox' | 'todo' | 'doing' | 'done'

export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type TagId = 'shopping' | 'work' | 'personal' | 'ideas' | 'others'

export type AgeState = 'fresh' | 'aging' | 'stale' | 'dusty'

export interface Subtask {
  id: string
  text: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  priority: Priority
  columnId: ColumnId
  tags: TagId[]
  dueDate: Date | null
  createdAt: Date
  recurrence: Recurrence | null
  subtasks: Subtask[]
  order: number
}

export interface Column {
  id: ColumnId
  title: string
  order: number
}

export interface AppState {
  tasks: Task[]
  columns: Column[]
  activeFilter: TagId | null
  focusMode: boolean
  compactMode: boolean
}

// ============================================
// TAG CONFIGURATION
// ============================================

export interface TagConfig {
  id: TagId
  name: string
  color: string
}

export const TAGS: readonly TagConfig[] = [
  { id: 'shopping', name: 'Shopping', color: '#FF6B6B' },
  { id: 'work', name: 'Work', color: '#4ECDC4' },
  { id: 'personal', name: 'Personal', color: '#966FD6' },
  { id: 'ideas', name: 'Ideas', color: '#FFD166' },
  { id: 'others', name: 'Others', color: '#888888' },
] as const

export const TAGS_BY_ID = Object.fromEntries(
  TAGS.map(tag => [tag.id, tag])
) as Record<TagId, TagConfig>

// ============================================
// COLUMN CONFIGURATION
// ============================================

export const COLUMNS: readonly Column[] = [
  { id: 'inbox', title: 'Inbox', order: 0 },
  { id: 'todo', title: 'To Do', order: 1 },
  { id: 'doing', title: 'Doing', order: 2 },
  { id: 'done', title: 'Done', order: 3 },
] as const

export const COLUMNS_BY_ID = Object.fromEntries(
  COLUMNS.map(col => [col.id, col])
) as Record<ColumnId, Column>

// ============================================
// PRIORITY CONFIGURATION
// ============================================

export interface PriorityConfig {
  id: Priority
  name: string
  color: string
  order: number
}

export const PRIORITIES: readonly PriorityConfig[] = [
  { id: 'urgent', name: 'Urgent', color: '#FF4444', order: 0 },
  { id: 'high', name: 'High', color: '#FF9500', order: 1 },
  { id: 'medium', name: 'Medium', color: '#BFFF00', order: 2 },
  { id: 'low', name: 'Low', color: '#666666', order: 3 },
] as const

// ============================================
// AGING CONFIGURATION
// ============================================

export interface AgeConfig {
  state: AgeState
  minDays: number
  maxDays: number | null
}

export const AGE_THRESHOLDS: readonly AgeConfig[] = [
  { state: 'fresh', minDays: 0, maxDays: 3 },
  { state: 'aging', minDays: 4, maxDays: 7 },
  { state: 'stale', minDays: 8, maxDays: 14 },
  { state: 'dusty', minDays: 15, maxDays: null },
] as const

// ============================================
// UTILITY TYPES
// ============================================

export type TaskCreate = Omit<Task, 'id' | 'createdAt'>
export type TaskUpdate = Partial<Omit<Task, 'id' | 'createdAt'>>

export interface MoveTaskParams {
  taskId: string
  targetColumnId: ColumnId
  targetIndex: number
}

