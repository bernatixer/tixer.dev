// ============================================
// TODO APP TYPES
// ============================================

export type Priority = 'urgent' | 'high' | 'medium' | 'low'

export type ColumnId = 'inbox' | 'todo' | 'blocked' | 'doing' | 'done'

export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type TagId = string

export type AgeState = 'fresh' | 'aging' | 'stale' | 'dusty'

export type TaskType = 'task' | 'book' | 'video' | 'article' | 'movie'

export interface Milestone {
  id: string
  text: string
  completed: boolean
}

// Blocked by can be a text reason or a dependency on another task
export type BlockedBy = 
  | { type: 'text'; reason: string }
  | { type: 'task'; taskId: string }

export interface Task {
  id: string
  title: string
  description: string | null
  priority: Priority
  columnId: ColumnId
  tags: TagId[]
  dueDate: Date | null
  createdAt: Date
  recurrence: Recurrence | null
  milestones: Milestone[]
  order: number
  blockedBy: BlockedBy | null
  taskType: TaskType
  url: string | null
  completedAt: Date | null
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
  createdAt: Date
}

const FALLBACK_TAG_COLORS = [
  '#4ECDC4',
  '#FF8A65',
  '#FFD166',
  '#5C7CFA',
  '#F06292',
  '#81C784',
  '#FFB74D',
  '#90A4AE',
] as const

const titleCase = (value: string) =>
  value
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())

const pickFallbackColor = (value: string) => {
  const hash = [...value].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return FALLBACK_TAG_COLORS[hash % FALLBACK_TAG_COLORS.length]
}

export const makeFallbackTag = (id: TagId): TagConfig => ({
  id,
  name: titleCase(id),
  color: pickFallbackColor(id),
  createdAt: new Date(0),
})

export const buildTagMap = (tags: TagConfig[]) =>
  Object.fromEntries(tags.map(tag => [tag.id, tag])) as Record<string, TagConfig>

export const mergeTagsWithTaskUsage = (tags: TagConfig[], tasks: Task[]): TagConfig[] => {
  const seen = new Set(tags.map(tag => tag.id))
  const merged = [...tags]

  for (const task of tasks) {
    for (const tagId of task.tags) {
      if (!seen.has(tagId)) {
        merged.push(makeFallbackTag(tagId))
        seen.add(tagId)
      }
    }
  }

  return merged
}

// ============================================
// COLUMN CONFIGURATION
// ============================================

export const COLUMNS: readonly Column[] = [
  { id: 'inbox', title: 'Inbox', order: 0 },
  { id: 'todo', title: 'To Do', order: 1 },
  { id: 'doing', title: 'Doing', order: 2 },
  { id: 'blocked', title: 'Blocked', order: 3 },
  { id: 'done', title: 'Done', order: 4 },
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
// TASK TYPE CONFIGURATION
// ============================================

export interface TaskTypeConfig {
  id: TaskType
  name: string
  icon: string
}

export const TASK_TYPES: readonly TaskTypeConfig[] = [
  { id: 'task', name: 'Task', icon: '📋' },
  { id: 'book', name: 'Book', icon: '📖' },
  { id: 'video', name: 'Video', icon: '▶️' },
  { id: 'article', name: 'Article', icon: '📰' },
  { id: 'movie', name: 'Movie', icon: '🎬' },
] as const

export const TASK_TYPES_BY_ID = Object.fromEntries(
  TASK_TYPES.map(t => [t.id, t])
) as Record<TaskType, TaskTypeConfig>

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
