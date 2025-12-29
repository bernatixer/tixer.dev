// ============================================
// TASK HOOKS - TanStack Query
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, MoveTaskRequest } from '@/api/tasks'
import type { Task, TaskCreate, ColumnId } from '@/todo/types'

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

export function useTasks() {
  return useQuery({
    queryKey: taskKeys.list(),
    queryFn: () => tasksApi.list(),
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
    onSuccess: (_, task) => {
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

      if (!task) {
        throw new Error('Task not found')
      }

      // Update the task with new column
      const updatedTask: Task = {
        ...task,
        columnId: params.targetColumnId,
      }

      // Call the backend to persist the change
      return tasksApi.update(task.id, updatedTask)
    },
    onMutate: async (params) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.list())

      // Optimistically update
      if (previousTasks) {
        const updated = previousTasks.map(task =>
          task.id === params.taskId
            ? { ...task, columnId: params.targetColumnId }
            : task
        )
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
    onSettled: () => {
      // Refetch to ensure we're in sync with the server
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useToggleSubtask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ taskId, subtaskId }: { taskId: string; subtaskId: string }) => {
      // Get current tasks from cache
      const tasks = queryClient.getQueryData<Task[]>(taskKeys.list())
      const task = tasks?.find(t => t.id === taskId)

      if (!task) {
        throw new Error('Task not found')
      }

      // Toggle the subtask
      const updatedTask: Task = {
        ...task,
        subtasks: task.subtasks.map(st =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        ),
      }

      // Call the backend to persist the change
      return tasksApi.update(task.id, updatedTask)
    },
    onMutate: async ({ taskId, subtaskId }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })

      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.list())

      if (previousTasks) {
        const updated = previousTasks.map(task => {
          if (task.id === taskId) {
            return {
              ...task,
              subtasks: task.subtasks.map(st =>
                st.id === subtaskId ? { ...st, completed: !st.completed } : st
              ),
            }
          }
          return task
        })
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
