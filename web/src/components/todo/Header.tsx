// ============================================
// HEADER COMPONENT
// ============================================

import { FC } from 'react'
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
        <h1 className="todo-title">Todo</h1>
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
      </div>
    </header>
  )
}
