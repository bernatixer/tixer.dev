// ============================================
// DRAG AND DROP MODULE
// ============================================

import type { ColumnId } from './types'
import { moveTask } from './state'

// ============================================
// STATE
// ============================================

let draggedCard: HTMLElement | null = null

// ============================================
// INITIALIZATION
// ============================================

export function initDragDrop(): void {
  // Setup task cards
  document.querySelectorAll('.task-card').forEach(card => {
    setupDragEvents(card as HTMLElement)
  })
  
  // Setup column drop zones
  document.querySelectorAll('.column-tasks').forEach(column => {
    setupDropZone(column as HTMLElement)
  })
}

export function setupDragEvents(card: HTMLElement): void {
  card.setAttribute('draggable', 'true')
  card.addEventListener('dragstart', handleDragStart)
  card.addEventListener('dragend', handleDragEnd)
}

function setupDropZone(column: HTMLElement): void {
  column.addEventListener('dragover', handleDragOver)
  column.addEventListener('dragenter', handleDragEnter)
  column.addEventListener('dragleave', handleDragLeave)
  column.addEventListener('drop', handleDrop)
}

// ============================================
// DRAG HANDLERS
// ============================================

function handleDragStart(this: HTMLElement, e: DragEvent): void {
  draggedCard = this
  this.classList.add('dragging')
  
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', this.innerHTML)
  }
}

function handleDragEnd(this: HTMLElement): void {
  this.classList.remove('dragging')
  
  // Clean up all drag-over classes
  document.querySelectorAll('.column-tasks').forEach(col => {
    col.classList.remove('drag-over')
  })
  document.querySelectorAll('.task-card').forEach(card => {
    card.classList.remove('drag-over')
  })
  
  draggedCard = null
  updateColumnCounts()
}

// ============================================
// DROP ZONE HANDLERS
// ============================================

function handleDragOver(this: HTMLElement, e: DragEvent): void {
  e.preventDefault()
  
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  
  const afterElement = getDragAfterElement(this, e.clientY)
  
  // Remove all drag-over classes from cards
  document.querySelectorAll('.task-card').forEach(card => {
    card.classList.remove('drag-over')
  })
  
  if (afterElement) {
    afterElement.classList.add('drag-over')
  }
}

function handleDragEnter(this: HTMLElement): void {
  this.classList.add('drag-over')
}

function handleDragLeave(this: HTMLElement, e: DragEvent): void {
  // Only remove if leaving the column entirely
  if (!this.contains(e.relatedTarget as Node)) {
    this.classList.remove('drag-over')
  }
}

function handleDrop(this: HTMLElement, e: DragEvent): void {
  e.preventDefault()
  this.classList.remove('drag-over')
  
  if (!draggedCard) return
  
  const taskId = draggedCard.dataset.taskId
  if (!taskId) return
  
  const targetColumn = this.closest('.todo-column') as HTMLElement
  const targetColumnId = targetColumn?.dataset.column as ColumnId
  
  if (!targetColumnId) return
  
  const afterElement = getDragAfterElement(this, e.clientY)
  const addButton = this.querySelector('.add-task-inline')
  
  // Calculate target index
  const cards = Array.from(this.querySelectorAll('.task-card:not(.dragging)'))
  let targetIndex = cards.length
  
  if (afterElement) {
    targetIndex = cards.indexOf(afterElement)
  }
  
  // Move in DOM
  if (afterElement) {
    this.insertBefore(draggedCard, afterElement)
  } else if (addButton) {
    this.insertBefore(draggedCard, addButton)
  } else {
    this.appendChild(draggedCard)
  }
  
  // Update state
  moveTask({
    taskId,
    targetColumnId,
    targetIndex,
  })
}

// ============================================
// UTILITIES
// ============================================

function getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
  const draggableElements = Array.from(
    container.querySelectorAll('.task-card:not(.dragging)')
  ) as HTMLElement[]
  
  return draggableElements.reduce<{ offset: number; element: HTMLElement | null }>(
    (closest, child) => {
      const box = child.getBoundingClientRect()
      const offset = y - box.top - box.height / 2
      
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child }
      }
      return closest
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element
}

export function updateColumnCounts(): void {
  document.querySelectorAll('.todo-column').forEach(column => {
    const count = column.querySelectorAll('.task-card').length
    const countEl = column.querySelector('.column-count')
    if (countEl) {
      countEl.textContent = String(count)
    }
  })
}

