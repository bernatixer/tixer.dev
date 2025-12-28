// ============================================
// TODO API SERVICE LAYER
// ============================================
// This module provides an API interface that can be swapped
// between mock (in-memory) and real backend implementations.

import type { 
  Task, 
  TaskCreate, 
  TaskUpdate, 
  ColumnId,
  MoveTaskParams
} from './types'
import * as state from './state'

// ============================================
// API INTERFACE
// ============================================

export interface TodoAPI {
  // Tasks
  getTasks(): Promise<Task[]>
  getTaskById(id: string): Promise<Task | null>
  getTasksByColumn(columnId: ColumnId): Promise<Task[]>
  createTask(task: TaskCreate): Promise<Task>
  updateTask(id: string, updates: TaskUpdate): Promise<Task | null>
  deleteTask(id: string): Promise<boolean>
  moveTask(params: MoveTaskParams): Promise<void>
  
  // Subtasks
  toggleSubtask(taskId: string, subtaskId: string): Promise<void>
  addSubtask(taskId: string, text: string): Promise<void>
}

// ============================================
// MOCK API IMPLEMENTATION
// ============================================

class MockTodoAPI implements TodoAPI {
  private initialized = false
  
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      state.initializeState()
      this.initialized = true
    }
    // Simulate network delay in development
    await this.simulateDelay()
  }
  
  private async simulateDelay(): Promise<void> {
    // Small delay to simulate network (can be removed in production)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  
  async getTasks(): Promise<Task[]> {
    await this.ensureInitialized()
    return [...state.getTasks()]
  }
  
  async getTaskById(id: string): Promise<Task | null> {
    await this.ensureInitialized()
    return state.getTaskById(id) ?? null
  }
  
  async getTasksByColumn(columnId: ColumnId): Promise<Task[]> {
    await this.ensureInitialized()
    return state.getTasksByColumn(columnId)
  }
  
  async createTask(taskData: TaskCreate): Promise<Task> {
    await this.ensureInitialized()
    return state.addTask(taskData)
  }
  
  async updateTask(id: string, updates: TaskUpdate): Promise<Task | null> {
    await this.ensureInitialized()
    return state.updateTask(id, updates) ?? null
  }
  
  async deleteTask(id: string): Promise<boolean> {
    await this.ensureInitialized()
    return state.deleteTask(id)
  }
  
  async moveTask(params: MoveTaskParams): Promise<void> {
    await this.ensureInitialized()
    state.moveTask(params)
  }
  
  async toggleSubtask(taskId: string, subtaskId: string): Promise<void> {
    await this.ensureInitialized()
    state.toggleSubtask(taskId, subtaskId)
  }
  
  async addSubtask(taskId: string, text: string): Promise<void> {
    await this.ensureInitialized()
    state.addSubtask(taskId, text)
  }
}

// ============================================
// API INSTANCE
// ============================================

// Export a singleton instance
// In the future, this can be swapped for a real API client
export const api: TodoAPI = new MockTodoAPI()

// ============================================
// FUTURE: REAL API IMPLEMENTATION
// ============================================

/*
// Example of how a real API implementation would look:

class RealTodoAPI implements TodoAPI {
  private baseUrl: string
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }
  
  private async fetch<T>(
    path: string, 
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers here
      },
      ...options,
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    return response.json()
  }
  
  async getTasks(): Promise<Task[]> {
    return this.fetch<Task[]>('/tasks')
  }
  
  async createTask(task: TaskCreate): Promise<Task> {
    return this.fetch<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    })
  }
  
  // ... other methods
}

// To use real API:
// export const api: TodoAPI = new RealTodoAPI('https://api.example.com')
*/

