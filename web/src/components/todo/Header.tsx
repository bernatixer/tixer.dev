// ============================================
// HEADER COMPONENT
// ============================================

import { FC } from 'react'
import type { TagId } from '@/todo/types'
import { TAGS_BY_ID } from '@/todo/types'

// ============================================
// FILTER INDICATOR
// ============================================

interface FilterIndicatorProps {
  activeFilter: TagId | null
  onClear: () => void
}

const FilterIndicator: FC<FilterIndicatorProps> = ({ activeFilter, onClear }) => {
  if (!activeFilter) return null

  return (
    <div className={`filter-indicator ${activeFilter ? 'visible' : ''}`} id="filter-indicator">
      <span>Filtering:</span>
      <span id="filter-name">{TAGS_BY_ID[activeFilter].name}</span>
      <span className="filter-clear" id="filter-clear" onClick={onClear}>
        ✕
      </span>
    </div>
  )
}

// ============================================
// HEADER
// ============================================

interface HeaderProps {
  focusMode: boolean
  compactMode: boolean
  activeFilter: TagId | null
  onToggleFocus: () => void
  onToggleCompact: () => void
  onClearFilter: () => void
  onNewTask: () => void
}

export const Header: FC<HeaderProps> = ({
  focusMode,
  compactMode,
  activeFilter,
  onToggleFocus,
  onToggleCompact,
  onClearFilter,
  onNewTask,
}) => {
  return (
    <header className="todo-header">
      <div className="header-left">
        <h1 className="todo-title">Todo</h1>
        <span className="focus-indicator">Focus Mode</span>
      </div>
      <div className="header-controls">
        <button
          className={`header-btn ${focusMode ? 'active' : ''}`}
          id="btn-focus"
          onClick={onToggleFocus}
        >
          Focus
        </button>
        <button
          className={`header-btn ${compactMode ? 'active' : ''}`}
          id="btn-compact"
          onClick={onToggleCompact}
        >
          Compact
        </button>
        <FilterIndicator activeFilter={activeFilter} onClear={onClearFilter} />
        <button className="btn-new-task" onClick={onNewTask}>
          New Task
        </button>
      </div>
    </header>
  )
}

