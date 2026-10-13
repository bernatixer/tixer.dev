// ============================================
// STYLED SELECT COMPONENT
// ============================================

import { FC, ReactNode, useState, useRef, useEffect, useMemo, useId, type KeyboardEvent } from 'react'

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

export interface StyledSelectProps {
  id?: string
  'aria-describedby'?: string
  'aria-label'?: string
  'aria-required'?: boolean
  'aria-invalid'?: boolean
  compact?: boolean
  disabled?: boolean
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

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  background: 'var(--void)',
  border: '1px solid rgba(var(--white-rgb), 0.15)',
  maxHeight: 'min(46vh, 420px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 100,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
}

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
  background: isSelected ? `color-mix(in srgb, ${accentColor} 13%, transparent)` : 'transparent',
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
  id,
  'aria-describedby': describedBy,
  'aria-label': label,
  'aria-required': required,
  'aria-invalid': invalid,
  compact = false,
  disabled = false,
}) => {
  const generatedId = useId()
  const triggerId = id ?? generatedId
  const listId = `${generatedId}-options`
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const selectedOption = options.find(opt => opt.id === value)
  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return searchable && q ? options.filter(opt => opt.label.toLowerCase().includes(q)) : options
  }, [options, query, searchable])
  const enabledOptions = visibleOptions.filter(option => !option.disabled)
  const activeOption = enabledOptions.find(option => option.id === activeId) ?? enabledOptions[0]
  const optionId = (option: SelectOption) => `${listId}-${options.indexOf(option)}`
  const open = isOpen && !disabled

  const close = (restoreFocus = false) => {
    setIsOpen(false)
    setQuery('')
    if (restoreFocus) triggerRef.current?.focus()
  }
  const show = (last = false) => {
    setQuery('')
    const enabled = options.filter(option => !option.disabled)
    setActiveId(enabled.find(option => option.id === value)?.id ?? (last ? enabled[enabled.length - 1] : enabled[0])?.id ?? null)
    setIsOpen(true)
  }
  const choose = (option: SelectOption) => {
    if (option.disabled) return
    onChange(option.id)
    close(true)
  }

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus()
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  useEffect(() => {
    if (open && activeOption) document.getElementById(optionId(activeOption))?.scrollIntoView({ block: 'nearest' })
  }, [open, activeOption?.id])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (event.key === 'Tab') { close(); return }
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    const navigation = ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
    if (navigation) {
      if (searchable && event.target === searchRef.current && ['Home', 'End'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      if (!open) { show(event.key === 'ArrowUp' || event.key === 'End'); return }
      if (!enabledOptions.length) return
      const index = enabledOptions.findIndex(option => option.id === activeOption?.id)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabledOptions.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + enabledOptions.length) % enabledOptions.length
      setActiveId(enabledOptions[next].id)
    } else if (event.key === 'Enter' || event.key === ' ' && event.target === triggerRef.current) {
      event.preventDefault()
      event.stopPropagation()
      if (!open) show()
      else if (activeOption) choose(activeOption)
    } else if (!searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const match = enabledOptions.find(option => option.label.toLowerCase().startsWith(event.key.toLowerCase()))
      if (match) { event.preventDefault(); setActiveId(match.id); setIsOpen(true) }
    }
  }

  return (
    <div ref={containerRef} style={{ ...containerStyle, marginBottom: compact ? 0 : containerStyle.marginBottom }} onKeyDown={handleKeyDown}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-label={label}
        aria-required={required}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !searchable && activeOption ? optionId(activeOption) : undefined}
        disabled={disabled}
        onClick={() => open ? close() : show()}
        style={{ ...triggerStyle(open, accentColor), ...(compact ? { padding: '8px 32px 8px 10px', minHeight: 38, fontSize: '.8rem' } : {}) }}
      >
        {selectedOption ? selectedOption.label : <span style={placeholderStyle}>{placeholder}</span>}
      </button>
      <span aria-hidden="true" style={arrowStyle(open)}>▼</span>
      {/* boffin: unmount closed options so their search field cannot receive focus. */}
      {open && <div style={dropdownStyle}>
        {searchable && <input ref={searchRef} type="text" value={query}
          onChange={event => { setQuery(event.target.value); setActiveId(null) }}
          role="combobox" aria-label={searchPlaceholder} aria-expanded="true" aria-controls={listId}
          aria-autocomplete="list" aria-activedescendant={activeOption ? optionId(activeOption) : undefined}
          placeholder={searchPlaceholder} style={searchStyle} />}
        <div id={listId} role="listbox" aria-label={label ?? placeholder} style={{ overflowY: 'auto' }}>
          {visibleOptions.length === 0 && <div role="status" style={emptyStyle}>No matches</div>}
          {visibleOptions.map(option => <div key={option.id} id={optionId(option)} role="option"
            aria-selected={option.id === value} aria-disabled={option.disabled || undefined}
            onPointerDown={event => event.preventDefault()}
            onClick={() => choose(option)}
            onMouseEnter={() => { if (!option.disabled) setActiveId(option.id) }}
            style={{ ...optionStyle(option.id === value || option.id === activeOption?.id, !!option.disabled, accentColor),
              outline: option.id === activeOption?.id ? `1px solid ${accentColor}` : undefined,
              outlineOffset: '-1px' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.label}</span>
            {option.meta}
          </div>)}
        </div>
      </div>}
    </div>
  )
}
