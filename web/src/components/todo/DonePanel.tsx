// ============================================
// DONE PANEL (Slide-over)
// ============================================

import { FC, useState, useEffect, useMemo } from 'react'
import type { Task, ColumnId } from '@/todo/types'
import { StatusCircle } from './StatusCircle'
import { useMoveTask } from '@/hooks/useTasks'

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

export const DonePanel: FC<DonePanelProps> = ({ isOpen, onClose, tasks }) => {
  const [limit, setLimit] = useState(DONE_PAGE_SIZE)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const { mutate: moveTask } = useMoveTask()

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
                <button
                  className="done-panel-copy"
                  onClick={() => handleCopyGroup(group)}
                  title="Copy this day's tasks for daily sync"
                >
                  {copiedLabel === group.label ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {group.tasks.map(task => (
                <div key={task.id} className="done-panel-item">
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
                </div>
              ))}
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
