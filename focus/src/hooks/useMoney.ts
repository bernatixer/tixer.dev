// ============================================
// MONEY — TanStack Query Hooks
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { moneyApi } from '@/api/money'
import type {
  ExpenseCreate,
  IncomeCreate,
  MoneySnapshot,
} from '@/money/types'

export const moneyKeys = {
  all: ['money'] as const,
  snapshot: () => [...moneyKeys.all, 'snapshot'] as const,
} as const

export function useMoneySnapshot(enabled = true) {
  return useQuery({
    queryKey: moneyKeys.snapshot(),
    queryFn: () => moneyApi.snapshot(),
    enabled,
  })
}

// ============================================
// INCOMES
// ============================================

export function useCreateIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: IncomeCreate) => moneyApi.createIncome(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: moneyKeys.all }),
  })
}

export function useUpdateIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: IncomeCreate }) =>
      moneyApi.updateIncome(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: moneyKeys.all }),
  })
}

export function useDeleteIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => moneyApi.deleteIncome(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: moneyKeys.snapshot() })
      const prev = qc.getQueryData<MoneySnapshot>(moneyKeys.snapshot())
      if (prev) {
        qc.setQueryData<MoneySnapshot>(moneyKeys.snapshot(), {
          ...prev,
          incomes: prev.incomes.filter(i => i.id !== id),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(moneyKeys.snapshot(), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: moneyKeys.all }),
  })
}

// ============================================
// EXPENSES
// ============================================

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExpenseCreate) => moneyApi.createExpense(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: moneyKeys.all }),
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenseCreate }) =>
      moneyApi.updateExpense(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: moneyKeys.all }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => moneyApi.deleteExpense(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: moneyKeys.snapshot() })
      const prev = qc.getQueryData<MoneySnapshot>(moneyKeys.snapshot())
      if (prev) {
        qc.setQueryData<MoneySnapshot>(moneyKeys.snapshot(), {
          ...prev,
          expenses: prev.expenses.filter(e => e.id !== id),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(moneyKeys.snapshot(), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: moneyKeys.all }),
  })
}
