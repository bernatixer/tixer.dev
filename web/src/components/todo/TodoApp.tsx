// ============================================
// TODO APP COMPONENT
// ============================================

import { FC, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { useFilter, useAuthSync } from '@/hooks'
import { useTasks } from '@/hooks/useTasks'
import { useTags } from '@/hooks/useTags'
import { Header } from './Header'
import { TodoBoard } from './TodoBoard'
import { NewTaskModal } from './NewTaskModal'
import { BlockTaskModal } from './BlockTaskModal'
import { DonePanel } from './DonePanel'
import { SignInPage } from './SignInPage'
import { get } from '@/api'
import { mergeTagsWithTaskUsage } from '@/todo/types'
import type { TagConfig, Task } from '@/todo/types'
import '@/styles/todo.css'

const VersionTag: FC = () => {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: () => get<{ status: string; commit: string }>('/health'),
    staleTime: 5 * 60_000,
    retry: false,
  })
  const backend = data?.commit ?? '…'
  return (
    <div className="version-tag" title={`web ${__APP_VERSION__} · api ${backend}`}>
      {__APP_VERSION__} · {backend}
    </div>
  )
}

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
  const { isReady } = useAuthSync()
  const { activeFilter, clear: clearFilter } = useFilter()
  const { data: tasks = [] } = useTasks(isReady)
  const { data: tags = [] } = useTags(isReady)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalColumnId, setModalColumnId] = useState<string>('todo')
  const [blockingTask, setBlockingTask] = useState<Task | null>(null)
  const [isDonePanelOpen, setIsDonePanelOpen] = useState(false)

  const doneTasks = tasks.filter(t => t.columnId === 'done')
  const availableTags: TagConfig[] = mergeTagsWithTaskUsage(tags, tasks)

  const handleNewTask = () => {
    setModalColumnId('todo')
    setIsModalOpen(true)
  }

  const handleAddTaskToColumn = (columnId: string) => {
    setModalColumnId(columnId)
    setIsModalOpen(true)
  }

  const handleBlockTask = (task: Task) => {
    setBlockingTask(task)
  }

  if (!isReady) {
    return <div className="loading">Loading...</div>
  }

  return (
    <>
      <Header
        activeFilter={activeFilter}
        availableTags={availableTags}
        onClearFilter={clearFilter}
        onNewTask={handleNewTask}
        doneCount={doneTasks.length}
        onOpenDone={() => setIsDonePanelOpen(true)}
      />

      <TodoBoard
        activeFilter={activeFilter}
        availableTags={availableTags}
        onAddTask={handleAddTaskToColumn}
        onBlockTask={handleBlockTask}
      />

      <NewTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        availableTags={availableTags}
        columnId={modalColumnId}
      />

      <BlockTaskModal
        isOpen={blockingTask !== null}
        onClose={() => setBlockingTask(null)}
        task={blockingTask}
        allTasks={tasks}
      />

      <DonePanel
        isOpen={isDonePanelOpen}
        onClose={() => setIsDonePanelOpen(false)}
        tasks={doneTasks}
      />
    </>
  )
}

// ============================================
// TODO APP
// ============================================

export const TodoApp: FC = () => {
  useEffect(() => {
    document.title = 'FOCUS'
  }, [])

  return (
    <>
      <SignedOut>
        <SignInPage />
      </SignedOut>
      <SignedIn>
        <div className="todo-container">
          <TopBar />
          <TodoContent />
          <VersionTag />
        </div>
      </SignedIn>
    </>
  )
}
