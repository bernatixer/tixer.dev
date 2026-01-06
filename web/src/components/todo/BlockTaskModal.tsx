// ============================================
// BLOCK TASK MODAL COMPONENT
// ============================================

import { FC, useState, FormEvent, useEffect, useMemo } from 'react'
import type { Task, BlockedBy } from '@/todo/types'
import { useBlockTask } from '@/hooks/useTasks'
import { StyledSelect, SelectOption } from './StyledSelect'

// ============================================
// STYLES
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
  border: '2px solid var(--priority-high)',
  boxShadow: '8px 8px 0 var(--priority-high)',
  padding: '32px',
  width: '100%',
  maxWidth: '420px',
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


const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '24px',
}

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 20px',
  background: 'var(--priority-high)',
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

const toggleGroupStyle: React.CSSProperties = {
  display: 'flex',
  marginBottom: '16px',
  border: '1px solid rgba(255, 255, 255, 0.15)',
}

const toggleButtonStyle = (isSelected: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '10px',
  background: isSelected ? 'rgba(255, 149, 0, 0.2)' : 'transparent',
  border: 'none',
  color: isSelected ? 'var(--priority-high)' : 'var(--bone)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.65rem',
  cursor: 'pointer',
  opacity: isSelected ? 1 : 0.5,
})

// ============================================
// COMPONENT
// ============================================

interface BlockTaskModalProps {
  isOpen: boolean
  onClose: () => void
  task: Task | null
  allTasks: Task[]
}

export const BlockTaskModal: FC<BlockTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  allTasks,
}) => {
  const [blockType, setBlockType] = useState<'text' | 'task'>('text')
  const [reason, setReason] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')

  const { mutate: blockTask, isPending } = useBlockTask()

  // Filter out the current task and completed tasks from the dependency options
  // Any non-completed task can be selected as a blocker
  const availableTasks = allTasks.filter(
    t => t.id !== task?.id && t.columnId !== 'done'
  )

  // Convert available tasks to select options
  const taskOptions: SelectOption[] = useMemo(() => 
    availableTasks.map(t => ({
      id: t.id,
      label: t.title,
    })),
    [availableTasks]
  )

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setBlockType('text')
      setReason('')
      setSelectedTaskId('')
    }
  }, [isOpen])

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

    if (!task) return

    let blockedBy: BlockedBy
    if (blockType === 'text') {
      if (!reason.trim()) return
      blockedBy = { type: 'text', reason: reason.trim() }
    } else {
      if (!selectedTaskId) return
      blockedBy = { type: 'task', taskId: selectedTaskId }
    }

    blockTask(
      { taskId: task.id, blockedBy },
      {
        onSuccess: () => {
          onClose()
        },
      }
    )
  }

  const isValid = blockType === 'text' ? reason.trim() : selectedTaskId

  if (!isOpen || !task) return null

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h2
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '8px',
            color: 'var(--priority-high)',
          }}
        >
          🚧 Block Task
        </h2>
        <p
          style={{
            fontSize: '0.8rem',
            opacity: 0.6,
            marginBottom: '24px',
          }}
        >
          "{task.title}"
        </p>

        <form onSubmit={handleSubmit}>
          {/* Block Type Toggle */}
          <div>
            <label style={labelStyle}>Blocked By</label>
            <div style={toggleGroupStyle}>
              <button
                type="button"
                onClick={() => setBlockType('text')}
                style={toggleButtonStyle(blockType === 'text')}
              >
                Reason / Text
              </button>
              <button
                type="button"
                onClick={() => setBlockType('task')}
                style={toggleButtonStyle(blockType === 'task')}
              >
                Another Task
              </button>
            </div>
          </div>

          {/* Text Reason */}
          {blockType === 'text' && (
            <div>
              <label style={labelStyle}>What's blocking this?</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g., Waiting for email reply"
                style={inputStyle}
                autoFocus
              />
            </div>
          )}

          {/* Task Dependency */}
          {blockType === 'task' && (
            <div>
              <label style={labelStyle}>Depends on which task?</label>
              <StyledSelect
                options={taskOptions}
                value={selectedTaskId}
                onChange={setSelectedTaskId}
                placeholder="Select a task..."
                accentColor="var(--priority-high)"
              />
            </div>
          )}

          {/* Buttons */}
          <div style={buttonRowStyle}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isPending}
              style={{
                ...primaryButtonStyle,
                opacity: !isValid || isPending ? 0.5 : 1,
                cursor: !isValid || isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Blocking...' : 'Block Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

