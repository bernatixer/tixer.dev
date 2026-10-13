// ============================================
// HEADER COMPONENT
// ============================================

import { FC, type ReactNode } from 'react'
import { UserButton } from '@clerk/clerk-react'
import { AppHeader } from '@/components/AppHeader'
import { buildTagMap } from '@/todo/types'
import type { TagConfig, TagId } from '@/todo/types'
import { enterFinance } from '@/analytics/posthog'

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

interface HeaderProps {
  activeFilter: TagId | null
  availableTags: TagConfig[]
  onClearFilter: () => void
  onNewTask: () => void
  doneCount: number
  onOpenDone: () => void
  account?: ReactNode
}

export const Header: FC<HeaderProps> = ({
  activeFilter,
  availableTags,
  onClearFilter,
  onNewTask,
  doneCount,
  onOpenDone,
  account = <UserButton appearance={{ elements: { avatarBox: 'user-avatar' } }} />,
}) => {
  return (
    <AppHeader mode="todo" onEnterFinance={enterFinance}>
        <FilterIndicator activeFilter={activeFilter} availableTags={availableTags} onClear={onClearFilter} />
        <button className="header-btn done-counter" onClick={onOpenDone}>
          Completed
          <span className="done-counter-badge">{doneCount}</span>
        </button>
        <button className="btn-new-task" onClick={onNewTask}>
          New Task
        </button>
        {account}
    </AppHeader>
  )
}
