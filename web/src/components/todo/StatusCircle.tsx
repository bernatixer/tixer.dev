// ============================================
// STATUS CIRCLE COMPONENT (Linear-inspired)
// ============================================

import { FC, useState, useRef, useEffect, MouseEvent } from 'react'
import type { ColumnId } from '@/todo/types'

// ============================================
// STATUS ICON SVGs
// ============================================

const StatusIcon: FC<{ columnId: ColumnId; size?: number }> = ({ columnId, size = 16 }) => {
  const r = size / 2 - 1.5
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  switch (columnId) {
    case 'inbox':
      // Empty dashed circle
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        </svg>
      )
    case 'todo':
      // Empty solid circle
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1.5"
          />
        </svg>
      )
    case 'doing':
      // Half-filled circle (progress indicator, static)
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(191,255,0,0.2)"
            strokeWidth="1.5"
          />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="var(--acid)"
            strokeWidth="1.5"
            strokeDasharray={`${circumference * 0.5} ${circumference * 0.5}`}
            strokeDashoffset={circumference * 0.25}
            strokeLinecap="round"
          />
        </svg>
      )
    case 'blocked':
      // Red circle with X
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="var(--priority-high)"
            strokeWidth="1.5"
          />
          <circle
            cx={cx} cy={cy} r={r * 0.35}
            fill="var(--priority-high)"
          />
        </svg>
      )
    case 'done':
      // Filled circle with checkmark
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx} cy={cy} r={r}
            fill="var(--acid)"
            stroke="var(--acid)"
            strokeWidth="1"
          />
          <polyline
            points={`${size * 0.28},${size * 0.5} ${size * 0.45},${size * 0.65} ${size * 0.72},${size * 0.35}`}
            fill="none"
            stroke="var(--void)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}

// ============================================
// STATUS LABELS
// ============================================

const STATUS_CONFIG: Record<ColumnId, { label: string; color: string }> = {
  inbox: { label: 'Inbox', color: 'rgba(255,255,255,0.5)' },
  todo: { label: 'To Do', color: 'rgba(255,255,255,0.7)' },
  doing: { label: 'In Progress', color: 'var(--acid)' },
  blocked: { label: 'Blocked', color: 'var(--priority-high)' },
  done: { label: 'Done', color: 'var(--acid)' },
}

// Column order for the dropdown
const STATUS_ORDER: ColumnId[] = ['inbox', 'todo', 'doing', 'blocked', 'done']

// ============================================
// STATUS CIRCLE
// ============================================

interface StatusCircleProps {
  columnId: ColumnId
  onChange: (newColumnId: ColumnId) => void
  size?: number
}

export const StatusCircle: FC<StatusCircleProps> = ({ columnId, onChange, size = 16 }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
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

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsOpen(prev => !prev)
  }

  const handleSelect = (newColumnId: ColumnId, e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (newColumnId !== columnId) {
      onChange(newColumnId)
    }
    setIsOpen(false)
  }

  return (
    <div className="status-circle-wrapper">
      <button
        ref={buttonRef}
        className="status-circle-btn"
        onClick={handleToggle}
        title={`Status: ${STATUS_CONFIG[columnId].label}`}
      >
        <StatusIcon columnId={columnId} size={size} />
      </button>
      {isOpen && (
        <div ref={dropdownRef} className="status-dropdown">
          <div className="status-dropdown-label">Change status...</div>
          {STATUS_ORDER.map((id) => {
            const config = STATUS_CONFIG[id]
            const isActive = id === columnId
            return (
              <button
                key={id}
                className={`status-dropdown-item ${isActive ? 'active' : ''}`}
                onClick={(e) => handleSelect(id, e)}
              >
                <StatusIcon columnId={id} size={14} />
                <span style={{ color: isActive ? config.color : undefined }}>
                  {config.label}
                </span>
                {isActive && <span className="status-check">&#10003;</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
