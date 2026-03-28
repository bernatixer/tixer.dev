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
    <div className={`filter-indicator ${activeFilter ? 'visible' : ''}`}>
      <span>Filtering:</span>
      <span>{TAGS_BY_ID[activeFilter].name}</span>
      <span className="filter-clear" onClick={onClear}>
        &#10005;
      </span>
    </div>
  )
}

// ============================================
// HEADER
// ============================================

interface HeaderProps {
  activeFilter: TagId | null
  onClearFilter: () => void
  onNewTask: () => void
  doneCount: number
  onOpenDone: () => void
}

export const Header: FC<HeaderProps> = ({
  activeFilter,
  onClearFilter,
  onNewTask,
  doneCount,
  onOpenDone,
}) => {
  return (
    <header className="todo-header">
      <div className="header-left">
        <h1 className="todo-title">Todo</h1>
      </div>
      <div className="header-controls">
        <FilterIndicator activeFilter={activeFilter} onClear={onClearFilter} />
        <button className="header-btn done-counter" onClick={onOpenDone}>
          Completed
          <span className="done-counter-badge">{doneCount}</span>
        </button>
        <button className="btn-new-task" onClick={onNewTask}>
          New Task
        </button>
      </div>
    </header>
  )
}
