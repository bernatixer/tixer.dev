// ============================================
// DONE PANEL (Slide-over)
// ============================================

import { FC, useState, useEffect, useMemo } from 'react'
import type { Task, ColumnId } from '@/todo/types'
import { StatusCircle } from './StatusCircle'
import { useMoveTask } from '@/hooks/useTasks'

const DONE_PAGE_SIZE = 15

interface DonePanelProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
}

export const DonePanel: FC<DonePanelProps> = ({ isOpen, onClose, tasks }) => {
  const [limit, setLimit] = useState(DONE_PAGE_SIZE)
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

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => b.order - a.order).slice(0, limit)
  }, [tasks, limit])

  const hasMore = tasks.length > limit

  const handleStatusChange = (task: Task, newColumnId: ColumnId) => {
    moveTask({ taskId: task.id, targetColumnId: newColumnId, targetIndex: 0 })
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
          {sortedTasks.map(task => (
            <div key={task.id} className="done-panel-item">
              <StatusCircle
                columnId="done"
                size={14}
                onChange={(newCol) => handleStatusChange(task, newCol)}
              />
              <span className="done-panel-title">{task.title}</span>
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
