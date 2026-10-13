import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MiniCalendar } from '../components/todo/MiniCalendar'
import { StyledSelect, type SelectOption } from '../components/todo/StyledSelect'
import './finance-controls.css'

export function FinanceTooltip({ text, label, children, style, role }: { text: string; label?: string; children: ReactNode; style?: CSSProperties; role?: 'img' }) {
  const id = useId()
  const hint = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLSpanElement>(null)
  const dismissal = useRef<ReturnType<typeof setTimeout>>()
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const close = () => { clearTimeout(dismissal.current); setAnchor(null) }
  const open = (element: HTMLSpanElement) => { clearTimeout(dismissal.current); setAnchor(element.getBoundingClientRect()) }
  const leave = () => {
    clearTimeout(dismissal.current)
    dismissal.current = setTimeout(() => { if (trigger.current !== document.activeElement) close() }, 200)
  }
  useEffect(() => () => clearTimeout(dismissal.current), [])
  useLayoutEffect(() => {
    if (!anchor || !hint.current) return
    const { width, height } = hint.current.getBoundingClientRect()
    setPosition({ left: Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8)), top: anchor.bottom + height + 16 <= window.innerHeight ? anchor.bottom + 8 : Math.max(8, anchor.top - height - 8) })
  }, [anchor, text])
  useEffect(() => {
    if (!anchor) return
    const reposition = () => {
      if (trigger.current !== document.activeElement) { setAnchor(null); return }
      const bounds = trigger.current!.getBoundingClientRect()
      setAnchor(bounds.bottom > 0 && bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth ? bounds : null)
    }
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const focus = (event: FocusEvent) => { if (event.target !== trigger.current) close() }
    document.addEventListener('keydown', keydown)
    document.addEventListener('focusin', focus)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('keydown', keydown); document.removeEventListener('focusin', focus)
      window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition)
    }
  }, [anchor])
  return <span ref={trigger} className="finance-tooltip-trigger" style={style} role={role} tabIndex={0} aria-label={label} aria-describedby={anchor ? id : undefined}
    onPointerEnter={event => open(event.currentTarget)} onPointerLeave={leave}
    onPointerDown={event => open(event.currentTarget)} onFocus={event => open(event.currentTarget)} onBlur={close}>
    {children}
    {anchor && createPortal(<div ref={hint} id={id} role="tooltip" className="finance-tooltip" style={position} onPointerEnter={() => clearTimeout(dismissal.current)} onPointerLeave={leave}>{text}</div>, document.body)}
  </span>
}

interface ControlProps {
  id?: string
  'aria-describedby'?: string
  'aria-label'?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
}

export interface FinanceSelectProps extends ControlProps {
  options: SelectOption[]
}

export function FinanceSelect({ options, value, onChange, required, disabled, ...accessibility }: FinanceSelectProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [invalid, setInvalid] = useState(false)
  const errorId = useId()
  const showError = invalid && required && !value
  return <div ref={ref} className="finance-select">
    <StyledSelect {...accessibility} options={options} value={value} onChange={onChange} disabled={disabled} compact aria-required={required} aria-invalid={!!showError}
      aria-describedby={[accessibility['aria-describedby'], showError ? errorId : null].filter(Boolean).join(' ') || undefined} />
    {required && <select className="finance-select__validation" value={value} required disabled={disabled}
      aria-hidden="true" tabIndex={-1} onChange={event => onChange(event.target.value)}
      onInvalid={event => {
        event.preventDefault()
        setInvalid(true)
        ref.current?.querySelector<HTMLButtonElement>('[role="combobox"]')?.focus()
      }}>
      {!options.some(option => option.id === '') && <option value="" />}
      {options.map(option => <option key={option.id} value={option.id} disabled={option.disabled}>{option.label}</option>)}
    </select>}
    {showError && <small id={errorId} role="alert">Please select an option.</small>}
  </div>
}

export interface FinanceDateInputProps extends ControlProps {
  min?: string
  max?: string
}

export function FinanceDateInput({ value, onChange, required, min, max, disabled, ...accessibility }: FinanceDateInputProps) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const calendar = popoverRef.current
    const selected = calendar?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]:not(:disabled)')
    const first = calendar?.querySelector<HTMLButtonElement>('button[aria-pressed]:not(:disabled)')
    const initialFocus = selected ?? first
    initialFocus?.focus()
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <div ref={ref} className="finance-date"
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={event => {
      if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    }}>
    {/* boffin: keep native date constraints on the editable input used by form validation. */}
    <input {...accessibility} type="date" value={value} required={required} min={min} max={max} disabled={disabled}
      onChange={event => onChange(event.target.value)} />
    <button ref={triggerRef} type="button" className="finance-date__trigger" disabled={disabled}
      aria-label="Choose date" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popoverId : undefined}
      onClick={() => {
        setAlignRight((ref.current?.getBoundingClientRect().left ?? 0) + 300 > window.innerWidth - 16)
        setOpen(current => !current)
      }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2Zm-1 8v10h12V10H6Zm2 3h3v3H8v-3Zm5 0h3v3h-3v-3Z" /></svg>
    </button>
    {open && !disabled && <div ref={popoverRef} id={popoverId} role="dialog" aria-label="Choose date"
      className="finance-date__popover" style={alignRight ? { right: 0 } : { left: 0 }}>
      <MiniCalendar selectedDate={value} min={min} max={max} onSelect={date => { onChange(date); close() }} />
      <button type="button" className="finance-date__clear" onClick={() => { onChange(''); close() }}>Clear date</button>
    </div>}
  </div>
}
