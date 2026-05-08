// ============================================
// APP STATE HOOKS
// ============================================

import { useState, useEffect, useCallback } from 'react'
import type { TagId, AgeState, Task } from '@/todo/types'
import { AGE_THRESHOLDS } from '@/todo/types'

// ============================================
// FOCUS MODE
// ============================================

export function useFocusMode() {
  const [focusMode, setFocusMode] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [focusMode])

  useEffect(() => {
    document.body.classList.toggle('focus-mode', focusMode)
    return () => {
      document.body.classList.remove('focus-mode')
    }
  }, [focusMode])

  const toggle = useCallback(() => setFocusMode(prev => !prev), [])

  return { focusMode, setFocusMode, toggle }
}

// ============================================
// COMPACT MODE
// ============================================

export function useCompactMode() {
  const [compactMode, setCompactMode] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('compact-mode', compactMode)
    return () => {
      document.body.classList.remove('compact-mode')
    }
  }, [compactMode])

  const toggle = useCallback(() => setCompactMode(prev => !prev), [])

  return { compactMode, setCompactMode, toggle }
}

// ============================================
// TAG FILTER
// ============================================

export function useFilter() {
  const [activeFilter, setActiveFilter] = useState<TagId | null>(null)

  useEffect(() => {
    document.body.classList.toggle('filtering', activeFilter !== null)
    return () => {
      document.body.classList.remove('filtering')
    }
  }, [activeFilter])

  const toggle = useCallback((tagId: TagId) => {
    setActiveFilter(prev => (prev === tagId ? null : tagId))
  }, [])

  const clear = useCallback(() => setActiveFilter(null), [])

  return { activeFilter, setActiveFilter, toggle, clear }
}

// ============================================
// TASK AGING
// ============================================

export function useTaskAge(task: Task): { ageState: AgeState; daysSinceCreation: number } {
  // Only apply aging to inbox and todo columns
  if (task.columnId !== 'inbox' && task.columnId !== 'todo') {
    return { ageState: 'fresh', daysSinceCreation: 0 }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const createdDate = new Date(task.createdAt)
  createdDate.setHours(0, 0, 0, 0)

  const daysSinceCreation = Math.floor(
    (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  let ageState: AgeState = 'fresh'

  for (const threshold of AGE_THRESHOLDS) {
    if (
      daysSinceCreation >= threshold.minDays &&
      (threshold.maxDays === null || daysSinceCreation <= threshold.maxDays)
    ) {
      ageState = threshold.state
      break
    }
  }

  return { ageState, daysSinceCreation }
}

// ============================================
// DUE DATE FORMATTING
// ============================================

export type DueDateStatus = 'overdue' | 'today' | 'soon' | 'future'

export function useDueDate(dueDate: Date | null): {
  formatted: string
  status: DueDateStatus
} | null {
  if (!dueDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const targetDate = new Date(dueDate)
  targetDate.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil(
    (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  let formatted: string
  let status: DueDateStatus

  if (diffDays < 0) {
    status = 'overdue'
    formatted = `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago`
  } else if (diffDays === 0) {
    status = 'today'
    formatted = 'Today'
  } else if (diffDays === 1) {
    status = 'soon'
    formatted = 'Tomorrow'
  } else if (diffDays <= 3) {
    status = 'soon'
    formatted = `In ${diffDays} days`
  } else {
    status = 'future'
    formatted = targetDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return { formatted, status }
}

