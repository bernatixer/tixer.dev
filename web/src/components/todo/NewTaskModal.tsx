// ============================================
// NEW TASK MODAL — Card-shaped composer
// ============================================

import { FC, useState, FormEvent, useEffect, KeyboardEvent as ReactKeyboardEvent, useRef, MouseEvent } from 'react'
import type { ColumnId, Milestone, Priority, TagConfig, TagId, TaskType } from '@/todo/types'
import { TASK_TYPES, TASK_TYPES_BY_ID } from '@/todo/types'
import { useCreateTask } from '@/hooks/useTasks'
import { TagEditor } from './TagEditor'
import { DueDateBadge } from './DueDateBadge'
import { PriorityPill } from './PriorityPill'
import { StatusCircle } from './StatusCircle'
import { MilestonesSection } from './Milestones'
import { isAiEnabled, parseTaskFromText } from '@/api/ai'

// ============================================
// TYPE SELECTOR
// ============================================

interface TypeSelectorProps {
  value: TaskType
  onChange: (next: TaskType) => void
}

const TypeSelector: FC<TypeSelectorProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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

  const config = TASK_TYPES_BY_ID[value]

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsOpen(prev => !prev)
  }

  const handleSelect = (next: TaskType, e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (next !== value) onChange(next)
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} className="type-selector-wrapper">
      <button
        type="button"
        className="type-selector-trigger"
        onClick={handleToggle}
        title={`Type: ${config.name}`}
      >
        <span className="type-selector-icon">{config.icon}</span>
      </button>
      {isOpen && (
        <div className="type-selector-dropdown">
          <div className="type-selector-label">Type</div>
          {TASK_TYPES.map(t => {
            const isActive = t.id === value
            return (
              <button
                key={t.id}
                type="button"
                className={`type-selector-item ${isActive ? 'active' : ''}`}
                onClick={(e) => handleSelect(t.id, e)}
              >
                <span>{t.icon}</span>
                <span>{t.name}</span>
                {isActive && <span className="type-selector-check">&#10003;</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================
// MODAL
// ============================================

interface NewTaskModalProps {
  isOpen: boolean
  onClose: () => void
  availableTags: TagConfig[]
  columnId?: string
}

export const NewTaskModal: FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  availableTags,
  columnId: initialColumnId = 'todo',
}) => {
  const [columnId, setColumnId] = useState<ColumnId>(initialColumnId as ColumnId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showDescription, setShowDescription] = useState(false)
  const [priority, setPriority] = useState<Priority>('medium')
  const [selectedTags, setSelectedTags] = useState<TagId[]>([])
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [taskType, setTaskType] = useState<TaskType>('task')
  const [url, setUrl] = useState('')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [newMilestoneText, setNewMilestoneText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const aiAvailable = isAiEnabled()

  const titleInputRef = useRef<HTMLInputElement>(null)
  const milestoneInputRef = useRef<HTMLInputElement>(null)
  const { mutate: createTask, isPending } = useCreateTask()

  // Reset on open
  useEffect(() => {
    if (!isOpen) return
    setColumnId(initialColumnId as ColumnId)
    setTitle('')
    setDescription('')
    setShowDescription(false)
    setPriority('medium')
    setSelectedTags([])
    setDueDate(null)
    setTaskType('task')
    setUrl('')
    setMilestones([])
    setNewMilestoneText('')
    setIsParsing(false)
    setParseError(null)
    // Defer focus so the input is mounted
    requestAnimationFrame(() => titleInputRef.current?.focus())
  }, [isOpen, initialColumnId])

  // ESC closes
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleAiParse = async () => {
    const text = title.trim()
    if (!text || isParsing) return
    setIsParsing(true)
    setParseError(null)
    try {
      const parsed = await parseTaskFromText(text, availableTags)
      setTitle(parsed.title)
      if (parsed.description) {
        setDescription(parsed.description)
        setShowDescription(true)
      }
      setPriority(parsed.priority)
      setDueDate(parsed.dueDate ? new Date(`${parsed.dueDate}T12:00:00`) : null)
      const tagIds = parsed.tags
        .map(name => availableTags.find(t => t.name.toLowerCase() === name.toLowerCase())?.id)
        .filter((id): id is TagId => Boolean(id))
      setSelectedTags(tagIds)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'AI parse failed')
    } finally {
      setIsParsing(false)
    }
  }

  const handleTitleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (aiAvailable && title.trim()) handleAiParse()
    }
  }

  const handleMilestoneToggle = (milestoneId: string) => {
    setMilestones(prev => prev.map(m => (m.id === milestoneId ? { ...m, completed: !m.completed } : m)))
  }

  const handleMilestoneDelete = (milestoneId: string) => {
    setMilestones(prev => prev.filter(m => m.id !== milestoneId))
  }

  const handleAddMilestone = () => {
    const text = newMilestoneText.trim()
    if (!text) return
    setMilestones(prev => [...prev, { id: crypto.randomUUID(), text, completed: false }])
    setNewMilestoneText('')
    milestoneInputRef.current?.focus()
  }

  const handleMilestoneKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddMilestone()
    } else if (e.key === 'Escape') {
      setNewMilestoneText('')
    }
  }

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!title.trim() || isPending) return
    createTask(
      {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        columnId,
        tags: selectedTags,
        dueDate,
        recurrence: null,
        milestones,
        taskType,
        url: url.trim() || null,
        order: 0,
        blockedBy: null,
        completedAt: null,
      },
      { onSuccess: () => onClose() }
    )
  }

  if (!isOpen) return null

  const titlePlaceholder = aiAvailable
    ? 'What needs to be done? (⌘+Enter to AI parse)'
    : taskType === 'task'
      ? 'What needs to be done?'
      : `What ${taskType} to capture?`

  return (
    <div className="new-task-overlay" onClick={onClose}>
      <div className="new-task-card-wrapper" onClick={e => e.stopPropagation()}>
        <form
          onSubmit={handleSubmit}
          className={`task-card variant-active priority-${priority} new-task-card`}
        >
          {/* Header: status, type, title, AI */}
          <div className="task-header">
            <div className="task-title-row">
              <StatusCircle columnId={columnId} onChange={setColumnId} size={18} />
              <TypeSelector value={taskType} onChange={setTaskType} />
              <input
                ref={titleInputRef}
                type="text"
                className="new-task-title-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                placeholder={titlePlaceholder}
              />
              {aiAvailable && (
                <button
                  type="button"
                  className={`new-task-ai-btn ${isParsing ? 'loading' : ''}`}
                  onClick={handleAiParse}
                  disabled={!title.trim() || isParsing}
                  title="Parse natural language (⌘+Enter)"
                >
                  {isParsing ? '✨…' : '✨'}
                </button>
              )}
            </div>
          </div>

          {parseError && <div className="new-task-parse-error">{parseError}</div>}

          {/* Description */}
          {showDescription ? (
            <textarea
              className="new-task-description-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="new-task-description-trigger"
              onClick={() => setShowDescription(true)}
            >
              + Add description
            </button>
          )}

          {/* URL for non-task types */}
          {taskType !== 'task' && (
            <input
              type="url"
              className="new-task-url-input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
            />
          )}

          {/* Milestones */}
          <div className="new-task-milestones">
            <MilestonesSection
              milestones={milestones}
              onToggle={handleMilestoneToggle}
              onDelete={handleMilestoneDelete}
              newMilestoneText={newMilestoneText}
              onNewMilestoneTextChange={setNewMilestoneText}
              onAddMilestone={handleAddMilestone}
              onNewMilestoneKeyDown={handleMilestoneKeyDown}
              inputRef={milestoneInputRef}
              variant="active"
            />
          </div>

          {/* Footer: pills + actions */}
          <div className="task-footer">
            <div className="task-footer-left new-task-pills">
              <PriorityPill priority={priority} onChange={setPriority} />
              <TagEditor tags={selectedTags} availableTags={availableTags} onChange={setSelectedTags} />
              <DueDateBadge dueDate={dueDate} onChange={setDueDate} />
            </div>
            <div className="new-task-actions">
              <button type="button" onClick={onClose} className="new-task-btn-cancel">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || isPending}
                className="new-task-btn-create"
              >
                {isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
