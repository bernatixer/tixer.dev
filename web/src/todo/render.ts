// ============================================
// RENDER MODULE
// ============================================

import type { Task, TagId } from './types'
import { TAGS_BY_ID } from './types'
import { calculateAge, getDaysSinceCreation } from './state'

// ============================================
// DATE FORMATTING
// ============================================

export function formatDueDate(date: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)
  
  if (targetDate.getTime() === today.getTime()) {
    return 'Today'
  }
  
  if (targetDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow'
  }
  
  return targetDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })
}

export function getDueDateClass(date: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)
  
  const diffDays = Math.ceil(
    (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )
  
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 3) return 'soon'
  return 'future'
}

// ============================================
// TASK CARD RENDERING
// ============================================

export function renderTaskCard(task: Task): string {
  const ageState = calculateAge(task)
  const days = getDaysSinceCreation(task)
  const hasSubtasks = task.subtasks.length > 0
  const completedSubtasks = task.subtasks.filter(st => st.completed).length
  
  const classes = [
    'task-card',
    `priority-${task.priority}`,
    hasSubtasks ? 'has-subtasks' : '',
  ].filter(Boolean).join(' ')
  
  const tagsAttr = task.tags.join(',')
  
  return `
    <div class="${classes}" 
         draggable="true" 
         data-task-id="${task.id}"
         data-age="${ageState}"
         data-tags="${tagsAttr}">
      <div class="task-header">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          ${hasSubtasks ? `<span class="progress-chip">${completedSubtasks}/${task.subtasks.length}</span>` : ''}
          ${days > 3 ? `<span class="age-badge">${days}d</span>` : '<span class="age-badge"></span>'}
          ${task.recurrence ? `<span class="recurring-badge">${capitalizeFirst(task.recurrence)}</span>` : ''}
          ${task.dueDate ? `<span class="due-date ${getDueDateClass(task.dueDate)}">${formatDueDate(task.dueDate)}</span>` : ''}
          <div class="tag-dots">
            ${task.tags.map(tag => `<span class="tag-dot dot-${tag}"></span>`).join('')}
          </div>
        </div>
      </div>
      ${hasSubtasks ? renderSubtasks(task) : ''}
      <div class="task-footer">
        <div class="task-tags">
          ${task.tags.map(tag => renderTag(tag)).join('')}
        </div>
      </div>
    </div>
  `
}

function renderSubtasks(task: Task): string {
  return `
    <div class="subtasks-container">
      ${task.subtasks.map(subtask => `
        <label class="subtask-item ${subtask.completed ? 'completed' : ''}" data-subtask-id="${subtask.id}">
          <input type="checkbox" class="subtask-checkbox" ${subtask.completed ? 'checked' : ''}>
          <span class="subtask-text">${escapeHtml(subtask.text)}</span>
        </label>
      `).join('')}
    </div>
  `
}

function renderTag(tagId: TagId): string {
  const tag = TAGS_BY_ID[tagId]
  return `<span class="task-tag tag-${tagId}" data-tag="${tagId}">${tag.name}</span>`
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

