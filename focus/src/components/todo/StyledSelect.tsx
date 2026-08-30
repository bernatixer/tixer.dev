// ============================================
// STYLED SELECT COMPONENT
// ============================================

import { FC, ReactNode, useState, useRef, useEffect, useMemo } from 'react'

// ============================================
// TYPES
// ============================================

export interface SelectOption {
  id: string
  label: string
  disabled?: boolean
  /** Rendered to the right of the label — a place, a priority dot, anything small. */
  meta?: ReactNode
}

interface StyledSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  accentColor?: string
  /** Show a filter box above the list. Worth it past ~8 options. */
  searchable?: boolean
  searchPlaceholder?: string
}

// ============================================
// STYLES
// ============================================

const containerStyle: React.CSSProperties = {
  position: 'relative',
  marginBottom: '16px',
}

const triggerStyle = (isOpen: boolean, accentColor: string): React.CSSProperties => ({
  width: '100%',
  padding: '12px 14px',
  paddingRight: '36px',
  background: 'rgba(var(--white-rgb), 0.05)',
  border: `1px solid ${isOpen ? accentColor : 'rgba(var(--white-rgb), 0.15)'}`,
  color: 'var(--bone)',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  outline: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'border-color 0.15s',
})

const arrowStyle = (isOpen: boolean): React.CSSProperties => ({
  position: 'absolute',
  right: '14px',
  top: '50%',
  transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`,
  pointerEvents: 'none',
  opacity: 0.5,
  fontSize: '0.6rem',
  transition: 'transform 0.15s',
})

const dropdownStyle = (isOpen: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  background: 'var(--void)',
  border: '1px solid rgba(var(--white-rgb), 0.15)',
  maxHeight: isOpen ? 'min(46vh, 420px)' : '0',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 100,
  opacity: isOpen ? 1 : 0,
  transition: 'max-height 0.2s ease, opacity 0.15s ease',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
})

const searchStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'rgba(var(--white-rgb), 0.04)',
  border: 'none',
  borderBottom: '1px solid rgba(var(--white-rgb), 0.1)',
  color: 'var(--bone)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.75rem',
  outline: 'none',
  flexShrink: 0,
}

const emptyStyle: React.CSSProperties = {
  padding: '14px',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
  opacity: 0.4,
}

const optionStyle = (isSelected: boolean, isDisabled: boolean, accentColor: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  padding: '9px 14px',
  cursor: isDisabled ? 'not-allowed' : 'pointer',
  background: isSelected ? `${accentColor}22` : 'transparent',
  color: isDisabled ? 'rgba(var(--white-rgb), 0.3)' : isSelected ? accentColor : 'var(--bone)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem',
  transition: 'background 0.1s',
  opacity: isDisabled ? 0.5 : 1,
  borderBottom: '1px solid rgba(var(--white-rgb), 0.05)',
})

const placeholderStyle: React.CSSProperties = {
  opacity: 0.5,
}

// ============================================
// COMPONENT
// ============================================

export const StyledSelect: FC<StyledSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  accentColor = 'var(--acid)',
  searchable = false,
  searchPlaceholder = 'Search…',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find(opt => opt.id === value)

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!searchable || !q) return options
    return options.filter(opt => opt.label.toLowerCase().includes(q))
  }, [options, query, searchable])

  useEffect(() => {
    if (isOpen && searchable) searchRef.current?.focus()
    if (!isOpen) setQuery('')
  }, [isOpen, searchable])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        setIsOpen(false)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const enabledOptions = visibleOptions.filter(opt => !opt.disabled)
        const currentIndex = enabledOptions.findIndex(opt => opt.id === value)
        let newIndex: number

        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < enabledOptions.length - 1 ? currentIndex + 1 : 0
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : enabledOptions.length - 1
        }

        onChange(enabledOptions[newIndex].id)
      } else if (e.key === 'Enter') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, visibleOptions, value, onChange])

  const handleOptionClick = (option: SelectOption) => {
    if (option.disabled) return
    onChange(option.id)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} style={containerStyle}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={triggerStyle(isOpen, accentColor)}
      >
        {selectedOption ? (
          selectedOption.label
        ) : (
          <span style={placeholderStyle}>{placeholder}</span>
        )}
      </button>
      <span style={arrowStyle(isOpen)}>▼</span>

      <div style={dropdownStyle(isOpen)}>
        {searchable && (
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={searchStyle}
            onClick={e => e.stopPropagation()}
          />
        )}
        <div style={{ overflowY: 'auto' }}>
        {visibleOptions.length === 0 && <div style={emptyStyle}>No matches</div>}
        {visibleOptions.map(option => (
          <div
            key={option.id}
            onClick={() => handleOptionClick(option)}
            onMouseEnter={e => {
              if (!option.disabled) {
                (e.currentTarget as HTMLElement).style.background = `${accentColor}11`
              }
            }}
            onMouseLeave={e => {
              if (!option.disabled && option.id !== value) {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
              } else if (option.id === value) {
                (e.currentTarget as HTMLElement).style.background = `${accentColor}22`
              }
            }}
            style={optionStyle(option.id === value, !!option.disabled, accentColor)}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {option.label}
            </span>
            {option.meta}
          </div>
        ))}
        </div>
      </div>
    </div>
  )
}

