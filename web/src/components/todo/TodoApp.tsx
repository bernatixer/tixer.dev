// ============================================
// TODO APP COMPONENT
// ============================================

import { FC, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFocusMode, useCompactMode, useFilter } from '@/hooks/useAppState'
import { Header } from './Header'
import { TodoBoard } from './TodoBoard'
import { NewTaskModal } from './NewTaskModal'
import type { ColumnId } from '@/todo/types'
import '@/styles/todo.css'

export const TodoApp: FC = () => {
  const { focusMode, toggle: toggleFocus } = useFocusMode()
  const { compactMode, toggle: toggleCompact } = useCompactMode()
  const { activeFilter, toggle: toggleFilter, clear: clearFilter } = useFilter()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [defaultColumn, setDefaultColumn] = useState<ColumnId>('inbox')

  const handleNewTask = () => {
    setDefaultColumn('inbox')
    setIsModalOpen(true)
  }

  const handleAddTaskToColumn = (columnId: ColumnId) => {
    setDefaultColumn(columnId)
    setIsModalOpen(true)
  }

  return (
    <div className="todo-container">
      <Link to="/" className="back-link">
        Back to home
      </Link>

      <Header
        focusMode={focusMode}
        compactMode={compactMode}
        activeFilter={activeFilter}
        onToggleFocus={toggleFocus}
        onToggleCompact={toggleCompact}
        onClearFilter={clearFilter}
        onNewTask={handleNewTask}
      />

      <TodoBoard
        activeFilter={activeFilter}
        onTagClick={toggleFilter}
        onAddTask={handleAddTaskToColumn}
      />

      <NewTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultColumn={defaultColumn}
      />
    </div>
  )
}
