// ============================================
// BANK API — Enable Banking integration
// ============================================

import { get, post, put, del } from './client'
import type {
  BankAccount,
  BankCategory,
  BankSession,
  BankStatus,
  BankTransaction,
  SyncResult,
} from '@/money/bank'

export interface UpdateTransactionPayload {
  category?: BankCategory
  userAmountCents?: number | null
  applyCategoryToMerchant?: boolean
  excluded?: boolean
  spreadMonths?: number | null
}

export const bankApi = {
  status: () => get<BankStatus>('/bank/status'),
  listSessions: () => get<{ sessions: BankSession[] }>('/bank/sessions'),
  importSession: (ebSessionId: string) =>
    post<{ ebSessionId: string }, { ok: boolean; sessionId: string }>('/bank/sessions/import', { ebSessionId }),
  deleteSession: (id: string) => del<void>(`/bank/sessions/${id}`),
  startAuth: (data: { redirectUrl: string; aspspName?: string; aspspCountry?: string }) =>
    post<typeof data, { url: string; state: string }>('/bank/auth/start', data),
  finalizeAuth: (data: { state: string; code: string }) =>
    post<typeof data, { ok: boolean; sessionId: string }>('/bank/auth/finalize', data),
  listAccounts: () => get<{ accounts: BankAccount[] }>('/bank/accounts'),
  sync: () => post<Record<string, never>, { results: SyncResult[]; note?: string }>('/bank/sync', {}),
  listTransactions: (limit = 200) =>
    get<{ transactions: BankTransaction[] }>(`/bank/transactions?limit=${limit}`),
  updateTransaction: (id: string, payload: UpdateTransactionPayload) =>
    put<UpdateTransactionPayload, { ok: boolean; appliedToMerchantCount: number }>(
      `/bank/transactions/${id}`,
      payload,
    ),
}
