// ============================================
// HEADER COMPONENT
// ============================================

import { FC } from 'react'
import { useTheme } from '@/hooks'
import { buildTagMap } from '@/todo/types'
import type { TagConfig, TagId } from '@/todo/types'

// ============================================
// FILTER INDICATOR
// ============================================

interface FilterIndicatorProps {
  activeFilter: TagId | null
  availableTags: TagConfig[]
  onClear: () => void
}

const FilterIndicator: FC<FilterIndicatorProps> = ({ activeFilter, availableTags, onClear }) => {
  if (!activeFilter) return null
  const tagsById = buildTagMap(availableTags)
  const activeTag = tagsById[activeFilter]

  return (
    <div className={`filter-indicator ${activeFilter ? 'visible' : ''}`}>
      <span>Filtering:</span>
      <span>{activeTag?.name ?? activeFilter}</span>
      <span className="filter-clear" onClick={onClear}>
        &#10005;
      </span>
    </div>
  )
}

// ============================================
// THEME TOGGLE
// ============================================

const ThemeToggle: FC = () => {
  const { themeId, toggle } = useTheme()
  const isDark = themeId === 'cyberDark'

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}

// ============================================
// HEADER
// ============================================

interface HeaderProps {
  activeFilter: TagId | null
  availableTags: TagConfig[]
  onClearFilter: () => void
  onNewTask: () => void
  doneCount: number
  onOpenDone: () => void
}

export const Header: FC<HeaderProps> = ({
  activeFilter,
  availableTags,
  onClearFilter,
  onNewTask,
  doneCount,
  onOpenDone,
}) => {
  return (
    <header className="todo-header">
      <div className="header-left">
        <h1 className="todo-title">
          <svg className="todo-title-logo" width="28" height="28" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="focus-ring" x1="72" y1="54" x2="196" y2="214" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#5A5A5A" />
                <stop offset="0.55" stopColor="#454545" />
                <stop offset="1" stopColor="#3E3E3E" />
              </linearGradient>
            </defs>
            <path
              d="M 205.055 99.954 A 82 82 0 1 1 150.602 49.177"
              stroke="url(#focus-ring)"
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="186.690" cy="69.310" r="22" fill="#BFFF00" />
          </svg>
          Focus
        </h1>
      </div>
      <div className="header-controls">
        <FilterIndicator activeFilter={activeFilter} availableTags={availableTags} onClear={onClearFilter} />
        <button className="header-btn done-counter" onClick={onOpenDone}>
          Completed
          <span className="done-counter-badge">{doneCount}</span>
        </button>
        <button className="btn-new-task" onClick={onNewTask}>
          New Task
        </button>
        <ThemeToggle />
      </div>
    </header>
  )
}
