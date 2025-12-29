// ============================================
// NEW TASK MODAL COMPONENT
// ============================================

import { FC, useState, FormEvent, useEffect } from 'react'
import type { Priority, ColumnId, TagId } from '@/todo/types'
import { TAGS, PRIORITIES, COLUMNS } from '@/todo/types'
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
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
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

  const { mutate: createTask, isPending } = useCreateTask()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setPriority('medium')
      setColumnId(defaultColumn)
      setSelectedTags([])
      setDueDate('')
    }
  }, [isOpen, defaultColumn])

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
          {/* Title */}
          <div>
            <label style={labelStyle}>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              style={inputStyle}
            />
          </div>

          {/* Priority */}
          <div>
            <label style={labelStyle}>Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              style={selectStyle}
            >
              {PRIORITIES.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Column */}
          <div>
            <label style={labelStyle}>Column</label>
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
          </div>

          {/* Due Date */}
          <div>
            <label style={labelStyle}>Due Date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              style={inputStyle}
            />
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

