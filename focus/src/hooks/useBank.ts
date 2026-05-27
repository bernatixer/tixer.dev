// ============================================
// BANK — TanStack Query Hooks
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bankApi, type UpdateTransactionPayload } from '@/api/bank'

export const bankKeys = {
  all: ['bank'] as const,
  status: () => [...bankKeys.all, 'status'] as const,
  sessions: () => [...bankKeys.all, 'sessions'] as const,
  accounts: () => [...bankKeys.all, 'accounts'] as const,
  transactions: (limit: number) => [...bankKeys.all, 'transactions', limit] as const,
} as const

export function useBankStatus(enabled = true) {
  return useQuery({
    queryKey: bankKeys.status(),
    queryFn: () => bankApi.status(),
    enabled,
    retry: false,
  })
}

export function useBankSessions(enabled = true) {
  return useQuery({
    queryKey: bankKeys.sessions(),
    queryFn: () => bankApi.listSessions(),
    enabled,
  })
}

export function useBankAccounts(enabled = true) {
  return useQuery({
    queryKey: bankKeys.accounts(),
    queryFn: () => bankApi.listAccounts(),
    enabled,
  })
}

export function useBankTransactions(enabled = true, limit = 200) {
  return useQuery({
    queryKey: bankKeys.transactions(limit),
    queryFn: () => bankApi.listTransactions(limit),
    enabled,
  })
}

export function useImportBankSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ebSessionId: string) => bankApi.importSession(ebSessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankKeys.all }),
  })
}

export function useStartBankAuth() {
  return useMutation({
    mutationFn: (data: { redirectUrl: string; aspspName?: string; aspspCountry?: string }) =>
      bankApi.startAuth(data),
  })
}

export function useFinalizeBankAuth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { state: string; code: string }) => bankApi.finalizeAuth(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankKeys.all }),
  })
}

export function useDeleteBankSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bankApi.deleteSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankKeys.all }),
  })
}

export function useSyncBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => bankApi.sync(),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankKeys.all }),
  })
}

export function useUpdateBankTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTransactionPayload }) =>
      bankApi.updateTransaction(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankKeys.all }),
  })
}
