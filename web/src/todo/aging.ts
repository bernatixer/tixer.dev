// ============================================
// TASK AGING MODULE
// ============================================

import type { Task, AgeState } from './types'
import { calculateAge, getDaysSinceCreation } from './state'

// ============================================
// DOM UPDATES
// ============================================

export function updateTaskAgingDisplay(taskElement: HTMLElement, task: Task): void {
  const ageState = calculateAge(task)
  const days = getDaysSinceCreation(task)
  
  // Update data-age attribute
  taskElement.dataset.age = ageState
  
  // Update age badge
  const ageBadge = taskElement.querySelector('.age-badge')
  if (ageBadge && days > 3) {
    ageBadge.textContent = `${days}d`
  }
}

export function updateAllTasksAging(tasks: readonly Task[]): void {
  tasks.forEach(task => {
    const taskElement = document.querySelector(`[data-task-id="${task.id}"]`) as HTMLElement | null
    if (taskElement) {
      updateTaskAgingDisplay(taskElement, task)
    }
  })
}

// ============================================
// FORMATTING
// ============================================

export function formatAge(task: Task): string {
  const days = getDaysSinceCreation(task)
  
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export function getAgeClass(ageState: AgeState): string {
  return ageState
}

