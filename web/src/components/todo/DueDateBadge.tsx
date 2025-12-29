// ============================================
// DUE DATE BADGE COMPONENT
// ============================================

import { FC } from 'react'
import { useDueDate } from '@/hooks/useAppState'

interface DueDateBadgeProps {
  dueDate: Date | null
}

export const DueDateBadge: FC<DueDateBadgeProps> = ({ dueDate }) => {
  const dateInfo = useDueDate(dueDate)

  if (!dateInfo) return null

  return (
    <span className={`due-date ${dateInfo.status}`}>
      {dateInfo.formatted}
    </span>
  )
}

