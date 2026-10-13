// ============================================
// MINI CALENDAR COMPONENT
// ============================================

import { FC, useEffect, useState } from 'react'

const calendarStyle: React.CSSProperties = {
  padding: '12px',
  background: 'rgba(var(--white-rgb), 0.03)',
  border: '1px solid rgba(var(--white-rgb), 0.1)',
}

const calendarHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
}

const calendarNavBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--bone)',
  cursor: 'pointer',
  padding: '4px 8px',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
  opacity: 0.6,
}

const calendarMonthStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--bone)',
}

const calendarGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '2px',
}

const calendarDayHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.5rem',
  textAlign: 'center',
  padding: '4px',
  color: 'var(--bone)',
  opacity: 0.4,
  textTransform: 'uppercase',
}

const calendarDayStyle = (isSelected: boolean, isToday: boolean, isCurrentMonth: boolean): React.CSSProperties => ({
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  padding: '6px 4px',
  textAlign: 'center',
  cursor: isCurrentMonth ? 'pointer' : 'default',
  background: isSelected ? 'var(--acid)' : isToday ? 'rgba(var(--acid-rgb), 0.15)' : 'transparent',
  color: isSelected ? 'var(--void)' : isCurrentMonth ? 'var(--bone)' : 'rgba(var(--white-rgb),0.2)',
  border: 'none',
  transition: 'all 0.1s',
})

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export const formatDateLocal = (date: Date): string => {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface MiniCalendarProps {
  selectedDate: string
  onSelect: (date: string) => void
  style?: React.CSSProperties
  min?: string
  max?: string
}

const parseLocalDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  // boffin: keep date-only values in the user's local calendar day.
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) && formatDateLocal(date) === value ? date : null
}

export const MiniCalendar: FC<MiniCalendarProps> = ({ selectedDate, onSelect, style, min, max }) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDateLocal(today)

  const minimum = min && parseLocalDate(min) ? min : undefined
  const maximum = max && parseLocalDate(max) ? max : undefined
  const [viewDate, setViewDate] = useState(() => {
    const fallback = minimum && todayStr < minimum ? minimum : maximum && todayStr > maximum ? maximum : todayStr
    return parseLocalDate(selectedDate) ?? parseLocalDate(fallback)!
  })

  useEffect(() => {
    const selected = parseLocalDate(selectedDate)
    if (selected) setViewDate(selected)
  }, [selectedDate])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const startDay = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  const days: { date: Date; isCurrentMonth: boolean }[] = []

  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
    })
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    })
  }

  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    })
  }

  const monthName = viewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  return (
    <div style={{ ...calendarStyle, ...style }}>
      <div style={calendarHeaderStyle}>
        <button type="button" aria-label="Previous month" disabled={!!minimum && formatDateLocal(new Date(year, month, 0)) < minimum} onClick={prevMonth} style={calendarNavBtnStyle}>
          ←
        </button>
        <span aria-live="polite" style={calendarMonthStyle}>{monthName}</span>
        <button type="button" aria-label="Next month" disabled={!!maximum && formatDateLocal(new Date(year, month + 1, 1)) > maximum} onClick={nextMonth} style={calendarNavBtnStyle}>
          →
        </button>
      </div>
      <div style={calendarGridStyle}>
        {DAYS.map(day => (
          <div key={day} style={calendarDayHeaderStyle}>
            {day}
          </div>
        ))}
        {days.map(({ date, isCurrentMonth }, idx) => {
          const dateStr = formatDateLocal(date)
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === todayStr
          const disabled = !isCurrentMonth || !!minimum && dateStr < minimum || !!maximum && dateStr > maximum

          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              aria-label={date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onSelect(dateStr)}
              style={calendarDayStyle(isSelected, isToday, !disabled)}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
