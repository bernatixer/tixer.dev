// ============================================
// PRIORITY PILL (Linear-inspired)
// ============================================

import { FC, useState, useRef, useEffect, MouseEvent } from 'react'
import type { Priority } from '@/todo/types'
import { PRIORITIES } from '@/todo/types'

// ============================================
// PRIORITY BAR ICON (like Linear's signal bars)
// ============================================

const PriorityIcon: FC<{ priority: Priority; size?: number }> = ({ priority, size = 14 }) => {
  const barWidth = 2
  const gap = 1.5
  const totalBars = 3
  const totalWidth = totalBars * barWidth + (totalBars - 1) * gap

  // How many bars are "filled" based on priority
  const filledBars = priority === 'urgent' ? 3 : priority === 'high' ? 3 : priority === 'medium' ? 2 : 1
  const color = priority === 'urgent' ? 'var(--priority-urgent)'
    : priority === 'high' ? 'var(--priority-high)'
    : priority === 'medium' ? 'var(--priority-medium)'
    : 'rgba(var(--white-rgb),0.3)'

  // Bar heights: short, medium, tall
  const barHeights = [0.4, 0.65, 1.0]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${(size - totalWidth) / 2}, ${size * 0.1})`}>
        {barHeights.map((heightPct, i) => {
          const barH = size * 0.8 * heightPct
          const x = i * (barWidth + gap)
          const y = size * 0.8 - barH
          const isFilled = i < filledBars
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={0.5}
              fill={isFilled ? color : 'rgba(var(--white-rgb),0.12)'}
            />
          )
        })}
      </g>
    </svg>
  )
}

// Urgent uses a special icon (exclamation)
const UrgentIcon: FC<{ size?: number }> = ({ size = 14 }) => {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect
        x={size * 0.42} y={size * 0.15}
        width={size * 0.16} height={size * 0.45}
        rx={1}
        fill="var(--priority-urgent)"
      />
      <circle
        cx={size * 0.5} cy={size * 0.78}
        r={size * 0.08}
        fill="var(--priority-urgent)"
      />
    </svg>
  )
}

// ============================================
// PRIORITY PILL
// ============================================

interface PriorityPillProps {
  priority: Priority
  onChange?: (newPriority: Priority) => void
  showLabel?: boolean
}

export const PriorityPill: FC<PriorityPillProps> = ({ priority, onChange, showLabel = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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
    if (onChange) setIsOpen(prev => !prev)
  }

  const handleSelect = (newPriority: Priority, e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (newPriority !== priority && onChange) {
      onChange(newPriority)
    }
    setIsOpen(false)
  }

  const config = PRIORITIES.find(p => p.id === priority)!

  return (
    <div className="priority-pill-wrapper">
      <button
        ref={buttonRef}
        className={`priority-pill priority-pill-${priority}`}
        onClick={handleToggle}
        title={`Priority: ${config.name}`}
      >
        {priority === 'urgent' ? <UrgentIcon size={12} /> : <PriorityIcon priority={priority} size={12} />}
        {showLabel && <span className="priority-pill-label">{config.name}</span>}
      </button>
      {isOpen && (
        <div ref={dropdownRef} className="priority-dropdown">
          <div className="priority-dropdown-label">Set priority to...</div>
          {PRIORITIES.map((p) => {
            const isActive = p.id === priority
            return (
              <button
                key={p.id}
                className={`priority-dropdown-item ${isActive ? 'active' : ''}`}
                onClick={(e) => handleSelect(p.id, e)}
              >
                {p.id === 'urgent' ? <UrgentIcon size={14} /> : <PriorityIcon priority={p.id} size={14} />}
                <span style={{ color: isActive ? p.color : undefined }}>{p.name}</span>
                {isActive && <span className="priority-check">&#10003;</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
