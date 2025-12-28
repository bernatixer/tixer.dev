// ============================================
// SUBTASKS MODULE
// ============================================

import { toggleSubtask } from './state'

// ============================================
// INITIALIZATION
// ============================================

export function initSubtasks(): void {
  // Setup expand/collapse on cards with subtasks
  document.querySelectorAll('.task-card.has-subtasks').forEach(card => {
    setupSubtaskToggle(card as HTMLElement)
  })
  
  // Setup checkbox handlers
  document.querySelectorAll('.subtask-checkbox').forEach(checkbox => {
    setupCheckboxHandler(checkbox as HTMLInputElement)
  })
}

export function setupSubtaskToggle(card: HTMLElement): void {
  card.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    
    // Don't toggle if clicking checkbox or tag
    if (
      target.classList.contains('subtask-checkbox') ||
      target.classList.contains('task-tag') ||
      target.closest('.task-tag')
    ) {
      return
    }
    
    card.classList.toggle('expanded')
  })
}

export function setupCheckboxHandler(checkbox: HTMLInputElement): void {
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation()
    
    const item = checkbox.closest('.subtask-item') as HTMLElement
    const card = checkbox.closest('.task-card') as HTMLElement
    const taskId = card?.dataset.taskId
    const subtaskId = item?.dataset.subtaskId
    
    if (!taskId || !subtaskId) return
    
    // Update DOM immediately for responsiveness
    if (checkbox.checked) {
      item.classList.add('completed')
    } else {
      item.classList.remove('completed')
    }
    
    // Update state
    toggleSubtask(taskId, subtaskId)
    
    // Update progress chip
    updateProgressChip(card)
  })
}

// ============================================
// PROGRESS CHIP
// ============================================

export function updateProgressChip(card: HTMLElement): void {
  const checkboxes = card.querySelectorAll('.subtask-checkbox')
  const checked = card.querySelectorAll('.subtask-checkbox:checked')
  const total = checkboxes.length
  const completed = checked.length
  
  const chip = card.querySelector('.progress-chip')
  if (chip) {
    chip.textContent = `${completed}/${total}`
    
    // Update chip state classes
    chip.classList.remove('complete', 'empty')
    if (completed === total && total > 0) {
      chip.classList.add('complete')
    } else if (completed === 0) {
      chip.classList.add('empty')
    }
  }
}

export function initAllProgressChips(): void {
  document.querySelectorAll('.task-card.has-subtasks').forEach(card => {
    updateProgressChip(card as HTMLElement)
  })
}

