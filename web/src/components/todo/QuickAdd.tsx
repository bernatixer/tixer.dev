// ============================================
// QUICK ADD BAR
// ============================================

import { FC, useState, KeyboardEvent, useRef } from 'react'
import { useCreateTask } from '@/hooks/useTasks'

interface QuickAddProps {
  targetColumn?: 'todo' | 'inbox'
}

export const QuickAdd: FC<QuickAddProps> = ({ targetColumn = 'todo' }) => {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { mutate: createTask, isPending } = useCreateTask()

  const handleSubmit = () => {
    const title = value.trim()
    if (!title || isPending) return

    createTask({
      title,
      description: null,
      priority: 'medium',
      columnId: targetColumn,
      tags: [],
      dueDate: null,
      recurrence: null,
      subtasks: [],
      taskType: 'task',
      url: null,
      order: 0,
      blockedBy: null,
    }, {
      onSuccess: () => {
        setValue('')
        inputRef.current?.focus()
      }
    })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setValue('')
      inputRef.current?.blur()
    }
  }

  return (
    <div className="quick-add">
      <span className="quick-add-icon">+</span>
      <input
        ref={inputRef}
        type="text"
        className="quick-add-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a task..."
        disabled={isPending}
      />
    </div>
  )
}
