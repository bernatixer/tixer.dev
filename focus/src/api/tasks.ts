// ============================================
// TASKS API - Typed Endpoint Definitions
// ============================================

import { get, post, put, del } from './client'
import type { Task, TaskCreate, ColumnId } from '@/todo/types'

// ============================================
// ENDPOINT DEFINITIONS
// ============================================

export const tasksApi = {
  // GET /tasks - List all tasks
  list: () => get<Task[]>('/tasks'),

  // GET /tasks/:id - Get a single task
  getById: (id: string) => get<Task>(`/tasks/${id}`),

  // POST /tasks - Create a new task
  create: (data: TaskCreate) => post<TaskCreate, Task>('/tasks', data),

  // PUT /tasks/:id - Update a task (full replacement)
  update: (id: string, data: Task) => put<Task, Task>(`/tasks/${id}`, data),

  // DELETE /tasks/:id - Delete a task
  delete: (id: string) => del<void>(`/tasks/${id}`),
} as const

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface MoveTaskRequest {
  taskId: string
  targetColumnId: ColumnId
  targetIndex: number
}

// Re-export types for convenience
export type { Task, TaskCreate }
