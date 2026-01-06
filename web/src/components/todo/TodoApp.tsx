// ============================================
// TODO APP COMPONENT
// ============================================

import { FC, useState } from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { useFocusMode, useCompactMode, useFilter, useAuthSync } from '@/hooks'
import { useTasks } from '@/hooks/useTasks'
import { Header } from './Header'
import { TodoBoard } from './TodoBoard'
import { NewTaskModal } from './NewTaskModal'
import { BlockTaskModal } from './BlockTaskModal'
import { SignInPage } from './SignInPage'
import type { ColumnId, Task } from '@/todo/types'
import '@/styles/todo.css'

// ============================================
// TOP BAR
// ============================================

const TopBar: FC = () => {
  return (
    <div className="top-bar">
      <Link to="/" className="back-link">
        Back to home
      </Link>
      <div className="top-bar-right">
        <UserButton 
          appearance={{
            elements: {
              avatarBox: 'user-avatar',
            },
          }}
        />
      </div>
    </div>
  )
}

// ============================================
// TODO CONTENT
// ============================================

const TodoContent: FC = () => {
  // Sync Clerk token with API client
  useAuthSync()

  const { focusMode, toggle: toggleFocus } = useFocusMode()
  const { compactMode, toggle: toggleCompact } = useCompactMode()
  const { activeFilter, toggle: toggleFilter, clear: clearFilter } = useFilter()
  const { data: tasks = [] } = useTasks()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [defaultColumn, setDefaultColumn] = useState<ColumnId>('inbox')
  const [blockingTask, setBlockingTask] = useState<Task | null>(null)

  const handleNewTask = () => {
    setDefaultColumn('inbox')
    setIsModalOpen(true)
  }

  const handleAddTaskToColumn = (columnId: ColumnId) => {
    setDefaultColumn(columnId)
    setIsModalOpen(true)
  }

  const handleBlockTask = (task: Task) => {
    setBlockingTask(task)
  }

  return (
    <>
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
        onBlockTask={handleBlockTask}
      />

      <NewTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultColumn={defaultColumn}
      />

      <BlockTaskModal
        isOpen={blockingTask !== null}
        onClose={() => setBlockingTask(null)}
        task={blockingTask}
        allTasks={tasks}
      />
    </>
  )
}

// ============================================
// TODO APP
// ============================================

export const TodoApp: FC = () => {
  return (
    <>
      <SignedOut>
        <SignInPage />
      </SignedOut>
      <SignedIn>
        <div className="todo-container">
          <TopBar />
          <TodoContent />
        </div>
      </SignedIn>
    </>
  )
}
