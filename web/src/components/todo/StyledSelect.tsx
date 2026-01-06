// ============================================
// STYLED SELECT COMPONENT
// ============================================

import { FC, useState, useRef, useEffect } from 'react'

// ============================================
// TYPES
// ============================================

export interface SelectOption {
  id: string
  label: string
  disabled?: boolean
}

interface StyledSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  accentColor?: string
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
  background: 'rgba(255, 255, 255, 0.05)',
  border: `1px solid ${isOpen ? accentColor : 'rgba(255, 255, 255, 0.15)'}`,
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
  border: '1px solid rgba(255, 255, 255, 0.15)',
  maxHeight: isOpen ? '240px' : '0',
  overflow: 'hidden',
  overflowY: 'auto',
  zIndex: 100,
  opacity: isOpen ? 1 : 0,
  transition: 'max-height 0.2s ease, opacity 0.15s ease',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
})

const optionStyle = (isSelected: boolean, isDisabled: boolean, accentColor: string): React.CSSProperties => ({
  padding: '10px 14px',
  cursor: isDisabled ? 'not-allowed' : 'pointer',
  background: isSelected ? `${accentColor}22` : 'transparent',
  color: isDisabled ? 'rgba(255, 255, 255, 0.3)' : isSelected ? accentColor : 'var(--bone)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.8rem',
  transition: 'background 0.1s',
  opacity: isDisabled ? 0.5 : 1,
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
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
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.id === value)

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
        const enabledOptions = options.filter(opt => !opt.disabled)
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
  }, [isOpen, options, value, onChange])

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
        {options.map(option => (
          <div
            key={option.id}
            onClick={() => handleOptionClick(option)}
            onMouseEnter={e => {
              if (!option.disabled) {
                (e.target as HTMLElement).style.background = `${accentColor}11`
              }
            }}
            onMouseLeave={e => {
              if (!option.disabled && option.id !== value) {
                (e.target as HTMLElement).style.background = 'transparent'
              } else if (option.id === value) {
                (e.target as HTMLElement).style.background = `${accentColor}22`
              }
            }}
            style={optionStyle(option.id === value, !!option.disabled, accentColor)}
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>
  )
}

