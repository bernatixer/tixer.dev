// ============================================
// TODO APP - MAIN ENTRY POINT
// ============================================

import '@/styles/shared.css'
import '@/styles/todo.css'

import { initializeState, subscribe } from './state'
import { initDragDrop, updateColumnCounts } from './drag-drop'
import { initFilters, setupTagClickHandlers } from './filters'
import { initModes } from './modes'
import { initSubtasks, initAllProgressChips } from './subtasks'
import { updateAllTasksAging } from './aging'
import { getTasks } from './state'

// ============================================
// INITIALIZATION
// ============================================

function init(): void {
  console.log('Todo app initializing...')
  
  // Initialize state with mock data
  initializeState()
  
  // Initialize all modules
  initDragDrop()
  initFilters()
  initModes()
  initSubtasks()
  
  // Setup tag click handlers
  setupTagClickHandlers()
  
  // Update aging display
  updateAllTasksAging(getTasks())
  
  // Initialize progress chips
  initAllProgressChips()
  
  // Update column counts
  updateColumnCounts()
  
  // Subscribe to task changes
  subscribe('tasksChanged', () => {
    updateColumnCounts()
    updateAllTasksAging(getTasks())
  })
  
  console.log('Todo app initialized!')
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

