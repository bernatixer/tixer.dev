// ============================================
// CATEGORY PICKER — inline dropdown for bank tx categories
// ============================================
//
// Mirrors the todo app's StatusCircle pattern: a tappable trigger that
// opens a dropdown of options; click an option to commit and close. Lives
// inside transaction rows so the user can re-categorize without going
// through the full edit modal.

import { FC, MouseEvent, useEffect, useRef, useState } from 'react'
import {
  BANK_CATEGORY_COLORS,
  BANK_CATEGORY_LABEL,
  type BankCategory,
} from '@/money/bank'

// User-pickable expense categories. Positive transactions automatically
// become income, internal transfers are system-only — neither shows here.
const ORDER: BankCategory[] = [
  'food',
  'transport',
  'housing',
  'clothing',
  'beauty',
  'decoration',
  'travel',
  'leisure',
  'gifts',
  'fitness',
  'investment',
]

interface CategoryPickerProps {
  category: BankCategory
  onChange: (next: BankCategory) => void
  // If true, render the trigger but mark it disabled (no dropdown).
  disabled?: boolean
  // Hint shown in the dropdown header.
  hint?: string
}

export const CategoryPicker: FC<CategoryPickerProps> = ({
  category,
  onChange,
  disabled,
  hint,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
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
    if (disabled) return
    setIsOpen((prev) => !prev)
  }

  const handleSelect = (next: BankCategory, e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsOpen(false)
    if (next !== category) onChange(next)
  }

  const color = BANK_CATEGORY_COLORS[category]
  const label = BANK_CATEGORY_LABEL[category]

  return (
    <span className="cat-picker">
      <button
        ref={triggerRef}
        type="button"
        className={`cat-picker__trigger ${disabled ? 'is-disabled' : ''}`}
        onClick={handleToggle}
        title={disabled ? label : 'Change category'}
      >
        <span className="cat-picker__dot" style={{ background: color }} />
        <span className="cat-picker__label">{label}</span>
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          className="cat-picker__menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cat-picker__menu-hint">{hint ?? 'Change category...'}</div>
          {ORDER.map((id) => {
            const active = id === category
            return (
              <button
                key={id}
                type="button"
                className={`cat-picker__item ${active ? 'active' : ''}`}
                onClick={(e) => handleSelect(id, e)}
              >
                <span className="cat-picker__dot" style={{ background: BANK_CATEGORY_COLORS[id] }} />
                <span>{BANK_CATEGORY_LABEL[id]}</span>
                {active && <span className="cat-picker__check">&#10003;</span>}
              </button>
            )
          })}
        </div>
      )}
    </span>
  )
}
