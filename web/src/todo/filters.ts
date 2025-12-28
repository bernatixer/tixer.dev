// ============================================
// TAG FILTERING MODULE
// ============================================

import type { TagId } from './types'
import { 
  getActiveFilter, 
  toggleFilter, 
  clearFilter,
  subscribe 
} from './state'

// ============================================
// DOM REFERENCES
// ============================================

let filterIndicator: HTMLElement | null = null
let filterName: HTMLElement | null = null
let filterClearBtn: HTMLElement | null = null

// ============================================
// INITIALIZATION
// ============================================

export function initFilters(): void {
  filterIndicator = document.getElementById('filter-indicator')
  filterName = document.getElementById('filter-name')
  filterClearBtn = document.getElementById('filter-clear')
  
  // Setup clear button
  filterClearBtn?.addEventListener('click', () => {
    clearFilter()
  })
  
  // Subscribe to filter changes
  subscribe('filterChanged', updateFilterDisplay)
  
  // Initial display update
  updateFilterDisplay()
}

// ============================================
// TAG CLICK HANDLER
// ============================================

export function handleTagClick(event: Event, tagId: TagId): void {
  event.stopPropagation()
  toggleFilter(tagId)
}

export function setupTagClickHandlers(): void {
  document.querySelectorAll('.task-tag').forEach(tag => {
    const tagElement = tag as HTMLElement
    const tagId = tagElement.dataset.tag as TagId | undefined
    
    if (tagId) {
      tagElement.addEventListener('click', (e) => handleTagClick(e, tagId))
    }
  })
}

// ============================================
// DISPLAY UPDATES
// ============================================

function updateFilterDisplay(): void {
  const activeFilter = getActiveFilter()
  
  if (activeFilter) {
    document.body.classList.add('filtering')
    filterIndicator?.classList.add('visible')
    
    if (filterName) {
      filterName.textContent = capitalizeFirst(activeFilter)
    }
    
    // Update task visibility
    document.querySelectorAll('.task-card').forEach(card => {
      const cardElement = card as HTMLElement
      const cardTags = cardElement.dataset.tags || ''
      
      if (cardTags.includes(activeFilter)) {
        cardElement.classList.remove('filtered-out')
      } else {
        cardElement.classList.add('filtered-out')
      }
    })
  } else {
    document.body.classList.remove('filtering')
    filterIndicator?.classList.remove('visible')
    
    // Show all tasks
    document.querySelectorAll('.task-card').forEach(card => {
      card.classList.remove('filtered-out')
    })
  }
}

// ============================================
// UTILITIES
// ============================================

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

