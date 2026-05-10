// ============================================
// WEEKLY GOALS — TanStack Query Hooks
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { weeklyGoalsApi } from '@/api/weeklyGoals'
import type {
  WeeklyGoal,
  WeeklyGoalCreate,
  WeeklyGoalsResponse,
} from '@/todo/goals'

export const weeklyGoalKeys = {
  all: ['weekly-goals'] as const,
  list: (week?: string) => [...weeklyGoalKeys.all, 'list', week ?? 'current'] as const,
} as const

export function useWeeklyGoals(enabled = true, week?: string) {
  return useQuery({
    queryKey: weeklyGoalKeys.list(week),
    queryFn: () => weeklyGoalsApi.list(week),
    enabled,
  })
}

export function useCreateWeeklyGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: WeeklyGoalCreate) => weeklyGoalsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeklyGoalKeys.all })
    },
  })
}

export function useUpdateWeeklyGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (goal: WeeklyGoal) => weeklyGoalsApi.update(goal.id, goal),
    onMutate: async (goal) => {
      await queryClient.cancelQueries({ queryKey: weeklyGoalKeys.all })
      const key = weeklyGoalKeys.list(goal.weekStart)
      const prev = queryClient.getQueryData<WeeklyGoalsResponse>(key)
      if (prev) {
        queryClient.setQueryData<WeeklyGoalsResponse>(key, {
          ...prev,
          goals: prev.goals.map(g => (g.id === goal.id ? goal : g)),
        })
      }
      // Also patch the "current" cache entry if we used it
      const currentKey = weeklyGoalKeys.list()
      const current = queryClient.getQueryData<WeeklyGoalsResponse>(currentKey)
      if (current && current.weekStart === goal.weekStart) {
        queryClient.setQueryData<WeeklyGoalsResponse>(currentKey, {
          ...current,
          goals: current.goals.map(g => (g.id === goal.id ? goal : g)),
        })
      }
      return { prev, key }
    },
    onError: (_err, _goal, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: weeklyGoalKeys.all })
    },
  })
}

export function useDeleteWeeklyGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => weeklyGoalsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeklyGoalKeys.all })
    },
  })
}
