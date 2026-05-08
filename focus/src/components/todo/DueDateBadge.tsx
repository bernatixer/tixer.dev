// ============================================
// DUE DATE BADGE COMPONENT
// ============================================

import { FC, MouseEvent, useEffect, useRef, useState } from 'react'
import { useDueDate } from '@/hooks/useAppState'
import { MiniCalendar, formatDateLocal } from './MiniCalendar'

interface DueDateBadgeProps {
  dueDate: Date | null
  onChange?: (newDate: Date | null) => void
}

const formatToInput = (date: Date | null): string => {
  if (!date) return ''
  return formatDateLocal(date instanceof Date ? date : new Date(date))
}

const quickOption = (offsetDays: number | null): Date | null => {
  if (offsetDays === null) return null
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d
}

export const DueDateBadge: FC<DueDateBadgeProps> = ({ dueDate, onChange }) => {
  const dateInfo = useDueDate(dueDate)
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        wrapperRef.current && !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen])

  if (!onChange && !dateInfo) return null

  const handleClick = (e: MouseEvent) => {
    if (!onChange) return
    e.stopPropagation()
    setIsOpen(prev => !prev)
  }

  const handleSelect = (dateStr: string) => {
    if (!onChange) return
    const next = new Date(`${dateStr}T12:00:00`)
    onChange(next)
    setIsOpen(false)
  }

  const handleQuick = (offsetDays: number | null, e: MouseEvent) => {
    if (!onChange) return
    e.stopPropagation()
    onChange(quickOption(offsetDays))
    setIsOpen(false)
  }

  const triggerClass = onChange
    ? `due-date due-date-editable ${dateInfo?.status ?? 'empty'}`
    : `due-date ${dateInfo?.status ?? ''}`

  const label = dateInfo ? dateInfo.formatted : 'Set due date'

  return (
    <span ref={wrapperRef} className="due-date-wrapper">
      <span
        className={triggerClass}
        onClick={handleClick}
        title={onChange ? 'Click to edit due date' : undefined}
        style={onChange ? { cursor: 'pointer' } : undefined}
      >
        {label}
      </span>
      {isOpen && onChange && (
        <div
          ref={popoverRef}
          className="due-date-popover"
          onClick={e => e.stopPropagation()}
        >
          <div className="due-date-popover-quick">
            <button type="button" onClick={(e) => handleQuick(0, e)}>Today</button>
            <button type="button" onClick={(e) => handleQuick(1, e)}>Tomorrow</button>
            <button type="button" onClick={(e) => handleQuick(7, e)}>+1 week</button>
            {dueDate && (
              <button
                type="button"
                className="due-date-popover-clear"
                onClick={(e) => handleQuick(null, e)}
              >
                Clear
              </button>
            )}
          </div>
          <MiniCalendar
            selectedDate={formatToInput(dueDate)}
            onSelect={handleSelect}
          />
        </div>
      )}
    </span>
  )
}
