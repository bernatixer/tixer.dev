// ============================================
// NEW TASK MODAL COMPONENT
// ============================================

import { FC, useState, FormEvent, useEffect } from 'react'
import type { Priority, ColumnId, TagId, TaskType } from '@/todo/types'
import { TAGS, PRIORITIES, COLUMNS, TASK_TYPES } from '@/todo/types'
import { useCreateTask } from '@/hooks/useTasks'

// ============================================
// STYLES (inline to keep it simple)
// ============================================

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  background: 'var(--void)',
  border: '2px solid var(--acid)',
  boxShadow: '8px 8px 0 var(--acid)',
  padding: '32px',
  width: '100%',
  maxWidth: '480px',
  maxHeight: '90vh',
  overflowY: 'auto',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: 'var(--bone)',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  marginBottom: '16px',
  outline: 'none',
}

const selectWrapperStyle: React.CSSProperties = {
  position: 'relative',
  marginBottom: '16px',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  paddingRight: '36px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: 'var(--bone)',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
}

const selectArrowStyle: React.CSSProperties = {
  position: 'absolute',
  right: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  opacity: 0.5,
  fontSize: '0.6rem',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.65rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  opacity: 0.6,
  marginBottom: '8px',
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '24px',
}

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 20px',
  background: 'var(--acid)',
  border: 'none',
  color: 'var(--void)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.75rem',
  letterSpacing: '0.05em',
  cursor: 'pointer',
  fontWeight: 600,
}

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 20px',
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  color: 'var(--bone)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.75rem',
  letterSpacing: '0.05em',
  cursor: 'pointer',
}

const tagContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '16px',
}

const tagButtonStyle = (isSelected: boolean, color: string): React.CSSProperties => ({
  padding: '6px 12px',
  background: isSelected ? `${color}33` : 'transparent',
  border: `1px solid ${isSelected ? color : 'rgba(255, 255, 255, 0.15)'}`,
  color: isSelected ? color : 'var(--bone)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.65rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 0.2s',
})

// Priority button group styles
const priorityGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0',
  marginBottom: '16px',
  border: '1px solid rgba(255, 255, 255, 0.15)',
}

const priorityButtonStyle = (isSelected: boolean, color: string, _isFirst: boolean, isLast: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '10px 8px',
  background: isSelected ? `${color}22` : 'transparent',
  border: 'none',
  borderRight: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
  color: isSelected ? color : 'var(--bone)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.65rem',
  letterSpacing: '0.03em',
  cursor: 'pointer',
  transition: 'all 0.15s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  opacity: isSelected ? 1 : 0.5,
})

// Due date quick select styles
const dueDateContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '16px',
  flexWrap: 'wrap',
}

const dueDateButtonStyle = (isSelected: boolean): React.CSSProperties => ({
  padding: '8px 14px',
  background: isSelected ? 'rgba(191, 255, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
  border: `1px solid ${isSelected ? 'var(--acid)' : 'rgba(255, 255, 255, 0.15)'}`,
  color: isSelected ? 'var(--acid)' : 'var(--bone)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.65rem',
  letterSpacing: '0.03em',
  cursor: 'pointer',
  transition: 'all 0.15s',
})

// Priority indicators
const PRIORITY_INDICATORS: Record<Priority, string> = {
  urgent: '↑↑',
  high: '↑',
  medium: '–',
  low: '↓',
}

// Task type selector styles
const typeGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginBottom: '16px',
}

const typeButtonStyle = (isSelected: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  background: isSelected ? 'rgba(191, 255, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
  border: `1px solid ${isSelected ? 'var(--acid)' : 'rgba(255, 255, 255, 0.15)'}`,
  color: isSelected ? 'var(--acid)' : 'var(--bone)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.65rem',
  letterSpacing: '0.03em',
  cursor: 'pointer',
  transition: 'all 0.15s',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
})

// URL input style
const urlInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: 'var(--bone)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.75rem',
  marginBottom: '16px',
  outline: 'none',
}

// Due date options
type DueDateOption = 'none' | 'today' | 'tomorrow' | 'next-week' | 'custom'

const getDueDateFromOption = (option: DueDateOption): string => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  switch (option) {
    case 'today':
      return today.toISOString().split('T')[0]
    case 'tomorrow': {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow.toISOString().split('T')[0]
    }
    case 'next-week': {
      const nextWeek = new Date(today)
      nextWeek.setDate(nextWeek.getDate() + 7)
      return nextWeek.toISOString().split('T')[0]
    }
    default:
      return ''
  }
}

// ============================================
// MINI CALENDAR COMPONENT
// ============================================

const calendarStyle: React.CSSProperties = {
  marginTop: '12px',
  marginBottom: '16px',
  padding: '12px',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
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
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.7rem',
  opacity: 0.6,
}

const calendarMonthStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
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
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.5rem',
  textAlign: 'center',
  padding: '4px',
  color: 'var(--bone)',
  opacity: 0.4,
  textTransform: 'uppercase',
}

const calendarDayStyle = (isSelected: boolean, isToday: boolean, isCurrentMonth: boolean): React.CSSProperties => ({
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.65rem',
  padding: '6px 4px',
  textAlign: 'center',
  cursor: isCurrentMonth ? 'pointer' : 'default',
  background: isSelected ? 'var(--acid)' : isToday ? 'rgba(191, 255, 0, 0.15)' : 'transparent',
  color: isSelected ? 'var(--void)' : isCurrentMonth ? 'var(--bone)' : 'rgba(255,255,255,0.2)',
  border: 'none',
  transition: 'all 0.1s',
})

interface MiniCalendarProps {
  selectedDate: string
  onSelect: (date: string) => void
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const MiniCalendar: FC<MiniCalendarProps> = ({ selectedDate, onSelect }) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      return new Date(selectedDate)
    }
    return new Date()
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const startDay = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  const days: { date: Date; isCurrentMonth: boolean }[] = []

  // Previous month's trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
    })
  }

  // Current month's days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    })
  }

  // Next month's leading days (fill to 42 = 6 rows)
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    })
  }

  const handleDayClick = (date: Date, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return
    const dateStr = date.toISOString().split('T')[0]
    onSelect(dateStr)
  }

  const monthName = viewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  return (
    <div style={calendarStyle}>
      <div style={calendarHeaderStyle}>
        <button type="button" onClick={prevMonth} style={calendarNavBtnStyle}>
          ←
        </button>
        <span style={calendarMonthStyle}>{monthName}</span>
        <button type="button" onClick={nextMonth} style={calendarNavBtnStyle}>
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
          const dateStr = date.toISOString().split('T')[0]
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === todayStr

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDayClick(date, isCurrentMonth)}
              style={calendarDayStyle(isSelected, isToday, isCurrentMonth)}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}


// ============================================
// COMPONENT
// ============================================

interface NewTaskModalProps {
  isOpen: boolean
  onClose: () => void
  defaultColumn?: ColumnId
}

export const NewTaskModal: FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  defaultColumn = 'inbox',
}) => {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [columnId, setColumnId] = useState<ColumnId>(defaultColumn)
  const [selectedTags, setSelectedTags] = useState<TagId[]>([])
  const [dueDate, setDueDate] = useState('')
  const [dueDateMode, setDueDateMode] = useState<DueDateOption>('none')
  const [showCalendar, setShowCalendar] = useState(false)
  const [taskType, setTaskType] = useState<TaskType>('task')
  const [url, setUrl] = useState('')

  const { mutate: createTask, isPending } = useCreateTask()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setPriority('medium')
      setColumnId(defaultColumn)
      setSelectedTags([])
      setDueDate('')
      setDueDateMode('none')
      setShowCalendar(false)
      setTaskType('task')
      setUrl('')
    }
  }, [isOpen, defaultColumn])
  
  const handleDueDateSelect = (option: DueDateOption) => {
    if (option === 'custom') {
      setShowCalendar(prev => !prev)
    } else if (option === 'none') {
      setDueDate('')
      setDueDateMode('none')
      setShowCalendar(false)
    } else {
      setDueDate(getDueDateFromOption(option))
      setDueDateMode(option)
      setShowCalendar(false)
    }
  }
  
  const handleCalendarSelect = (dateStr: string) => {
    setDueDate(dateStr)
    setDueDateMode('custom')
  }
  
  // Format custom date for display
  const formatCustomDate = (dateStr: string): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    if (!title.trim()) return

    createTask(
      {
        title: title.trim(),
        priority,
        columnId,
        tags: selectedTags,
        dueDate: dueDate ? new Date(dueDate) : null,
        recurrence: null,
        subtasks: [],
        taskType,
        url: url.trim() || null,
        order: 0,
        blockedBy: null,
      },
      {
        onSuccess: () => {
          onClose()
        },
      }
    )
  }

  const toggleTag = (tagId: TagId) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    )
  }

  if (!isOpen) return null

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h2
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '24px',
            color: 'var(--acid)',
          }}
        >
          New Task
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Task Type */}
          <div>
            <label style={labelStyle}>Type</label>
            <div style={typeGroupStyle}>
              {TASK_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTaskType(t.id)}
                  style={typeButtonStyle(taskType === t.id)}
                >
                  <span>{t.icon}</span>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={taskType === 'task' ? 'What needs to be done?' : `What ${taskType} to check out?`}
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* URL (shown for non-task types) */}
          {taskType !== 'task' && (
            <div>
              <label style={labelStyle}>URL (optional)</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                style={urlInputStyle}
              />
            </div>
          )}

          {/* Priority - Button Group */}
          <div>
            <label style={labelStyle}>Priority</label>
            <div style={priorityGroupStyle}>
              {PRIORITIES.map((p, index) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  style={priorityButtonStyle(
                    priority === p.id,
                    p.color,
                    index === 0,
                    index === PRIORITIES.length - 1
                  )}
                >
                  <span>{PRIORITY_INDICATORS[p.id]}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Column */}
          <div>
            <label style={labelStyle}>Column</label>
            <div style={selectWrapperStyle}>
              <select
                value={columnId}
                onChange={e => setColumnId(e.target.value as ColumnId)}
                style={selectStyle}
              >
                {COLUMNS.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <span style={selectArrowStyle}>▼</span>
            </div>
          </div>

          {/* Due Date - Quick Select */}
          <div>
            <label style={labelStyle}>Due Date</label>
            <div style={dueDateContainerStyle}>
              <button
                type="button"
                onClick={() => handleDueDateSelect('none')}
                style={dueDateButtonStyle(dueDateMode === 'none')}
              >
                None
              </button>
              <button
                type="button"
                onClick={() => handleDueDateSelect('today')}
                style={dueDateButtonStyle(dueDateMode === 'today')}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleDueDateSelect('tomorrow')}
                style={dueDateButtonStyle(dueDateMode === 'tomorrow')}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => handleDueDateSelect('next-week')}
                style={dueDateButtonStyle(dueDateMode === 'next-week')}
              >
                +1 Week
              </button>
              <button
                type="button"
                onClick={() => handleDueDateSelect('custom')}
                style={dueDateButtonStyle(dueDateMode === 'custom' || showCalendar)}
              >
                {dueDateMode === 'custom' ? formatCustomDate(dueDate) : '···'}
              </button>
            </div>
            {showCalendar && (
              <MiniCalendar selectedDate={dueDate} onSelect={handleCalendarSelect} />
            )}
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags</label>
            <div style={tagContainerStyle}>
              {TAGS.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  style={tagButtonStyle(selectedTags.includes(tag.id), tag.color)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div style={buttonRowStyle}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isPending}
              style={{
                ...primaryButtonStyle,
                opacity: !title.trim() || isPending ? 0.5 : 1,
                cursor: !title.trim() || isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


