// ============================================
// DONE PANEL (Slide-over)
// ============================================

import { FC, useState, useEffect, useMemo } from 'react'
import type { Task, ColumnId } from '@/todo/types'
import { StatusCircle } from './StatusCircle'
import { useMoveTask } from '@/hooks/useTasks'
import { composeStandup, isAiEnabled } from '@/api/ai'

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

const DONE_PAGE_SIZE = 15

interface DonePanelProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
}

interface DoneGroup {
  label: string
  tasks: Task[]
}

type AiState = 'idle' | 'loading' | 'copied' | 'error'

export const DonePanel: FC<DonePanelProps> = ({ isOpen, onClose, tasks }) => {
  const [limit, setLimit] = useState(DONE_PAGE_SIZE)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [aiStates, setAiStates] = useState<Record<string, AiState>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const aiAvailable = isAiEnabled()
  const { mutate: moveTask } = useMoveTask()

  useEffect(() => {
    if (!isOpen) {
      setAiStates({})
      setExpandedId(null)
    }
  }, [isOpen])

  // Reset limit when panel opens
  useEffect(() => {
    if (isOpen) setLimit(DONE_PAGE_SIZE)
  }, [isOpen])

  // ESC to close
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const groupedTasks = useMemo<DoneGroup[]>(() => {
    const sorted = [...tasks]
      .sort((a, b) => {
        const left = new Date(b.completedAt ?? b.createdAt).getTime()
        const right = new Date(a.completedAt ?? a.createdAt).getTime()
        return left - right
      })
      .slice(0, limit)

    const groups: DoneGroup[] = []

    for (const task of sorted) {
      const completedAt = new Date(task.completedAt ?? task.createdAt)
      const label = completedAt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      const lastGroup = groups.length > 0 ? groups[groups.length - 1] : undefined

      if (!lastGroup || lastGroup.label !== label) {
        groups.push({ label, tasks: [task] })
      } else {
        lastGroup.tasks.push(task)
      }
    }

    return groups
  }, [tasks, limit])

  const hasMore = tasks.length > limit

  const handleStatusChange = (task: Task, newColumnId: ColumnId) => {
    moveTask({ taskId: task.id, targetColumnId: newColumnId, targetIndex: 0 })
  }

  const handleCopyGroup = async (group: DoneGroup) => {
    const lines = [
      `Done — ${group.label}:`,
      ...group.tasks.map(task => `• ${task.title}`),
    ]
    const ok = await copyToClipboard(lines.join('\n'))
    if (ok) {
      setCopiedLabel(group.label)
      window.setTimeout(() => {
        setCopiedLabel(prev => (prev === group.label ? null : prev))
      }, 1500)
    }
  }

  const setAiState = (label: string, state: AiState) => {
    setAiStates(prev => ({ ...prev, [label]: state }))
  }

  const handleAiCompose = async (group: DoneGroup) => {
    setAiState(group.label, 'loading')
    try {
      const message = await composeStandup(
        group.label,
        group.tasks.map(t => t.title)
      )
      const ok = await copyToClipboard(message)
      if (!ok) throw new Error('clipboard write failed')
      setAiState(group.label, 'copied')
      window.setTimeout(() => {
        setAiStates(prev => {
          if (prev[group.label] !== 'copied') return prev
          const next = { ...prev }
          delete next[group.label]
          return next
        })
      }, 1800)
    } catch {
      setAiState(group.label, 'error')
      window.setTimeout(() => {
        setAiStates(prev => {
          if (prev[group.label] !== 'error') return prev
          const next = { ...prev }
          delete next[group.label]
          return next
        })
      }, 2000)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="done-panel-overlay" onClick={onClose} />
      <div className="done-panel">
        <div className="done-panel-header">
          <h2>Completed</h2>
          <span className="done-panel-count">{tasks.length}</span>
          <button className="done-panel-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="done-panel-list">
          {groupedTasks.map(group => (
            <div key={group.label} className="done-panel-group">
              <div className="done-panel-date">
                <span>{group.label}</span>
                <div className="done-panel-date-actions">
                  <button
                    className="done-panel-copy"
                    onClick={() => handleCopyGroup(group)}
                    title="Copy this day's tasks as plain text"
                  >
                    {copiedLabel === group.label ? 'Copied!' : 'Copy'}
                  </button>
                  {aiAvailable && (
                    <button
                      className="done-panel-ai"
                      onClick={() => handleAiCompose(group)}
                      disabled={aiStates[group.label] === 'loading'}
                      title="Compose a polished Slack message with AI and copy it"
                    >
                      {aiStates[group.label] === 'loading' && '✨ …'}
                      {aiStates[group.label] === 'copied' && '✨ Copied!'}
                      {aiStates[group.label] === 'error' && '✨ Failed'}
                      {!aiStates[group.label] && '✨ Slack'}
                    </button>
                  )}
                </div>
              </div>
              {group.tasks.map(task => {
                const hasDetails = Boolean(task.description) || task.milestones.length > 0
                const isExpanded = expandedId === task.id
                return (
                  <div key={task.id} className={`done-panel-item ${isExpanded ? 'expanded' : ''}`}>
                    <div
                      className={`done-panel-row ${hasDetails ? 'has-details' : ''}`}
                      onClick={hasDetails ? () => setExpandedId(prev => prev === task.id ? null : task.id) : undefined}
                    >
                      <StatusCircle
                        columnId="done"
                        size={14}
                        onChange={(newCol) => handleStatusChange(task, newCol)}
                      />
                      <span className="done-panel-title">{task.title}</span>
                      <span className="done-panel-time">
                        {new Date(task.completedAt ?? task.createdAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      {hasDetails && (
                        <span className={`done-panel-chevron ${isExpanded ? 'open' : ''}`} aria-hidden>
                          ⌄
                        </span>
                      )}
                    </div>
                    {isExpanded && hasDetails && (
                      <div className="done-panel-details">
                        {task.description && (
                          <div className="done-panel-description">{task.description}</div>
                        )}
                        {task.milestones.length > 0 && (
                          <ul className="done-panel-milestones">
                            {task.milestones.map(m => (
                              <li
                                key={m.id}
                                className={`done-panel-milestone ${m.completed ? 'completed' : ''}`}
                              >
                                <span className="done-panel-milestone-mark">
                                  {m.completed ? '✓' : '·'}
                                </span>
                                <span>{m.text}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {hasMore && (
            <button
              className="done-panel-load-more"
              onClick={() => setLimit(prev => prev + DONE_PAGE_SIZE)}
            >
              Load more ({tasks.length - limit} remaining)
            </button>
          )}
          {tasks.length === 0 && (
            <div className="done-panel-empty">No completed tasks yet</div>
          )}
        </div>
      </div>
    </>
  )
}
