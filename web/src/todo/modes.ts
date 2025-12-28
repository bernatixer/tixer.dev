// ============================================
// FOCUS & COMPACT MODE MODULE
// ============================================

import { 
  toggleFocusMode, 
  toggleCompactMode, 
  isFocusMode, 
  isCompactMode,
  setFocusMode,
  subscribe 
} from './state'

// ============================================
// DOM REFERENCES
// ============================================

let btnFocus: HTMLElement | null = null
let btnCompact: HTMLElement | null = null

// ============================================
// INITIALIZATION
// ============================================

export function initModes(): void {
  btnFocus = document.getElementById('btn-focus')
  btnCompact = document.getElementById('btn-compact')
  
  // Focus mode button
  btnFocus?.addEventListener('click', () => {
    toggleFocusMode()
  })
  
  // Compact mode button
  btnCompact?.addEventListener('click', () => {
    toggleCompactMode()
  })
  
  // ESC to exit focus mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFocusMode()) {
      setFocusMode(false)
    }
  })
  
  // Subscribe to mode changes
  subscribe('focusModeChanged', updateFocusModeDisplay)
  subscribe('compactModeChanged', updateCompactModeDisplay)
  
  // Initial display
  updateFocusModeDisplay()
  updateCompactModeDisplay()
}

// ============================================
// DISPLAY UPDATES
// ============================================

function updateFocusModeDisplay(): void {
  const isActive = isFocusMode()
  
  if (isActive) {
    document.body.classList.add('focus-mode')
    btnFocus?.classList.add('active')
  } else {
    document.body.classList.remove('focus-mode')
    btnFocus?.classList.remove('active')
  }
}

function updateCompactModeDisplay(): void {
  const isActive = isCompactMode()
  
  if (isActive) {
    document.body.classList.add('compact-mode')
    btnCompact?.classList.add('active')
  } else {
    document.body.classList.remove('compact-mode')
    btnCompact?.classList.remove('active')
  }
}

