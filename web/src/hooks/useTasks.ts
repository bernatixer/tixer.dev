// ============================================
// TASK HOOKS - TanStack Query
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, MoveTaskRequest } from '@/api/tasks'
import type { Task, TaskCreate, ColumnId, BlockedBy } from '@/todo/types'

// ============================================
// QUERY KEYS
// ============================================

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: () => [...taskKeys.lists()] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
} as const

// ============================================
// QUERIES
// ============================================

export function useTasks(enabled = true) {
  return useQuery({
    queryKey: taskKeys.list(),
    queryFn: () => tasksApi.list(),
    enabled,
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => tasksApi.getById(id),
    enabled: !!id,
  })
}

export function useTasksByColumn(columnId: ColumnId) {
  const { data: tasks = [], ...rest } = useTasks()
  return {
    ...rest,
    data: tasks.filter(task => task.columnId === columnId),
  }
}

// ============================================
// MUTATIONS
// ============================================

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TaskCreate) => tasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: Task) => tasksApi.update(task.id, task),
    onMutate: async (updatedTask) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.list())

      // Optimistically update the cache
      if (previousTasks) {
        const updated = previousTasks.map(t => 
          t.id === updatedTask.id ? updatedTask : t
        )
        queryClient.setQueryData(taskKeys.list(), updated)
      }

      return { previousTasks }
    },
    onError: (_err, _task, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.list(), context.previousTasks)
      }
    },
    onSettled: (_, __, task) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(task.id) })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useMoveTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: MoveTaskRequest) => {
      // Get current tasks from cache
      const tasks = queryClient.getQueryData<Task[]>(taskKeys.list())
      const task = tasks?.find(t => t.id === params.taskId)

      if (!task || !tasks) {
        throw new Error('Task not found')
      }

      // Calculate the new order value
      const targetColumnTasks = tasks.filter(
        t => t.columnId === params.targetColumnId && t.id !== params.taskId
      )
      
      let newOrder = params.targetIndex
      if (targetColumnTasks.length > 0) {
        if (params.targetIndex === 0) {
          // Insert at the beginning
          newOrder = targetColumnTasks[0].order - 1
        } else if (params.targetIndex >= targetColumnTasks.length) {
          // Insert at the end
          newOrder = Math.max(...targetColumnTasks.map(t => t.order)) + 1
        } else {
          // Insert in the middle
          const prevOrder = targetColumnTasks[params.targetIndex - 1].order
          const nextOrder = targetColumnTasks[params.targetIndex].order
          newOrder = Math.floor((prevOrder + nextOrder) / 2)
          if (newOrder === prevOrder || newOrder === nextOrder) {
            newOrder = prevOrder + 1
          }
        }
      }

      // Update the task with new column and order
      const updatedTask: Task = {
        ...task,
        columnId: params.targetColumnId,
        order: newOrder,
      }

      // Call the backend to persist the change
      return tasksApi.update(task.id, updatedTask)
    },
    onMutate: async (params) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.list())

      // Optimistically update with reordering support
      if (previousTasks) {
        const task = previousTasks.find(t => t.id === params.taskId)
        if (!task) return { previousTasks }

        // Get tasks in the target column (excluding the moving task)
        const targetColumnTasks = previousTasks.filter(
          t => t.columnId === params.targetColumnId && t.id !== params.taskId
        )
        // Get tasks in other columns (excluding the moving task)
        const otherTasks = previousTasks.filter(
          t => t.columnId !== params.targetColumnId && t.id !== params.taskId
        )

        // Calculate the new order value based on target index
        let newOrder = params.targetIndex
        if (targetColumnTasks.length > 0) {
          if (params.targetIndex === 0) {
            // Insert at the beginning
            newOrder = targetColumnTasks[0].order - 1
          } else if (params.targetIndex >= targetColumnTasks.length) {
            // Insert at the end
            newOrder = Math.max(...targetColumnTasks.map(t => t.order)) + 1
          } else {
            // Insert in the middle - use average of surrounding orders
            const prevOrder = targetColumnTasks[params.targetIndex - 1].order
            const nextOrder = targetColumnTasks[params.targetIndex].order
            newOrder = Math.floor((prevOrder + nextOrder) / 2)
            // If orders are too close, we'll need to renumber (but for now, just use the average)
            if (newOrder === prevOrder || newOrder === nextOrder) {
              newOrder = prevOrder + 1
            }
          }
        }

        // Insert the task at the target index with updated order
        const updatedTask = { ...task, columnId: params.targetColumnId, order: newOrder }
        targetColumnTasks.splice(params.targetIndex, 0, updatedTask)

        // Combine all tasks back together
        const updated = [...otherTasks, ...targetColumnTasks]
        queryClient.setQueryData(taskKeys.list(), updated)
      }

      return { previousTasks }
    },
    onError: (_err, _params, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.list(), context.previousTasks)
      }
    },
    onSuccess: async (updatedTask) => {
      // When a task is moved to "done", unblock any tasks that depend on it
      if (updatedTask.columnId === 'done') {
        const tasks = queryClient.getQueryData<Task[]>(taskKeys.list())
        if (tasks) {
          const dependentTasks = tasks.filter(
            t => t.blockedBy?.type === 'task' && t.blockedBy.taskId === updatedTask.id
          )
          
          // Unblock each dependent task (move to todo and clear blockedBy)
          for (const task of dependentTasks) {
            const unblocked: Task = {
              ...task,
              columnId: 'todo',
              blockedBy: null,
            }
            await tasksApi.update(task.id, unblocked)
          }
        }
      }
    },
    onSettled: () => {
      // Refetch to ensure we're in sync with the server
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useToggleSubtask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ task, subtaskId }: { task: Task; subtaskId: string }) => {
      // Compute the update using the original task passed in
      const updatedTask: Task = {
        ...task,
        subtasks: task.subtasks.map(st =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        ),
      }
      return tasksApi.update(task.id, updatedTask)
    },
    onMutate: async ({ task, subtaskId }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })

      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.list())

      // Create the updated task
      const updatedTask: Task = {
        ...task,
        subtasks: task.subtasks.map(st =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        ),
      }

      // Update cache optimistically
      if (previousTasks) {
        const updated = previousTasks.map(t => t.id === task.id ? updatedTask : t)
        queryClient.setQueryData(taskKeys.list(), updated)
      }

      return { previousTasks }
    },
    onError: (_err, _params, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.list(), context.previousTasks)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useBlockTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ taskId, blockedBy }: { taskId: string; blockedBy: BlockedBy }) => {
      const tasks = queryClient.getQueryData<Task[]>(taskKeys.list())
      const task = tasks?.find(t => t.id === taskId)

      if (!task) {
        throw new Error('Task not found')
      }

      const updatedTask: Task = {
        ...task,
        columnId: 'blocked',
        blockedBy,
      }

      return tasksApi.update(task.id, updatedTask)
    },
    onMutate: async ({ taskId, blockedBy }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.list())

      if (previousTasks) {
        const updated = previousTasks.map(task =>
          task.id === taskId ? { ...task, columnId: 'blocked' as ColumnId, blockedBy } : task
        )
        queryClient.setQueryData(taskKeys.list(), updated)
      }

      return { previousTasks }
    },
    onError: (_err, _params, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.list(), context.previousTasks)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useUnblockTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const tasks = queryClient.getQueryData<Task[]>(taskKeys.list())
      const task = tasks?.find(t => t.id === taskId)

      if (!task) {
        throw new Error('Task not found')
      }

      const updatedTask: Task = {
        ...task,
        columnId: 'todo',
        blockedBy: null,
      }

      return tasksApi.update(task.id, updatedTask)
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.list())

      if (previousTasks) {
        const updated = previousTasks.map(task =>
          task.id === taskId ? { ...task, columnId: 'todo' as ColumnId, blockedBy: null } : task
        )
        queryClient.setQueryData(taskKeys.list(), updated)
      }

      return { previousTasks }
    },
    onError: (_err, _params, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.list(), context.previousTasks)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useAddSubtask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ task, text }: { task: Task; text: string }) => {
      const newSubtask = {
        id: crypto.randomUUID(),
        text: text.trim(),
        completed: false,
      }

      const updatedTask: Task = {
        ...task,
        subtasks: [...task.subtasks, newSubtask],
      }

      return tasksApi.update(task.id, updatedTask)
    },
    onMutate: async ({ task, text }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })

      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.list())

      const newSubtask = {
        id: crypto.randomUUID(),
        text: text.trim(),
        completed: false,
      }

      const updatedTask: Task = {
        ...task,
        subtasks: [...task.subtasks, newSubtask],
      }

      if (previousTasks) {
        const updated = previousTasks.map(t => t.id === task.id ? updatedTask : t)
        queryClient.setQueryData(taskKeys.list(), updated)
      }

      return { previousTasks }
    },
    onError: (_err, _params, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.list(), context.previousTasks)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}
