// ============================================
// MONEY API — POC, localStorage-backed only
// ============================================
//
// Backend wiring deferred until the UI shape is locked in. Same pattern
// as the weekly-goals mock — flip USE_MOCK once a real backend exists.

import type {
  Expense,
  ExpenseCreate,
  Income,
  IncomeCreate,
  MoneySnapshot,
} from '@/money/types'

const STORAGE_KEY = 'focus.mock.money.v1'

const nowIso = () => new Date().toISOString()

interface Store {
  incomes: Income[]
  expenses: Expense[]
}

const readStore = (): Store => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { incomes: [], expenses: [] }
    const parsed = JSON.parse(raw) as Store
    return {
      incomes: parsed.incomes ?? [],
      expenses: parsed.expenses ?? [],
    }
  } catch {
    return { incomes: [], expenses: [] }
  }
}

const writeStore = (store: Store) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

// No prefilled seed — every manual income/expense in this app is
// something the user explicitly added via the + buttons.

export const moneyApi = {
  snapshot: async (): Promise<MoneySnapshot> => {
    const { incomes, expenses } = readStore()
    return {
      incomes: [...incomes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      expenses: [...expenses].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }
  },
  createIncome: async (data: IncomeCreate): Promise<Income> => {
    const income: Income = { ...data, id: crypto.randomUUID(), createdAt: nowIso() }
    const store = readStore()
    writeStore({ ...store, incomes: [...store.incomes, income] })
    return income
  },
  updateIncome: async (id: string, data: IncomeCreate): Promise<Income> => {
    const store = readStore()
    const next = store.incomes.map(i => (i.id === id ? { ...i, ...data } : i))
    const updated = next.find(i => i.id === id)
    if (!updated) throw new Error('Income not found')
    writeStore({ ...store, incomes: next })
    return updated
  },
  deleteIncome: async (id: string): Promise<void> => {
    const store = readStore()
    writeStore({ ...store, incomes: store.incomes.filter(i => i.id !== id) })
  },
  createExpense: async (data: ExpenseCreate): Promise<Expense> => {
    const expense: Expense = { ...data, id: crypto.randomUUID(), createdAt: nowIso() }
    const store = readStore()
    writeStore({ ...store, expenses: [...store.expenses, expense] })
    return expense
  },
  updateExpense: async (id: string, data: ExpenseCreate): Promise<Expense> => {
    const store = readStore()
    const next = store.expenses.map(e => (e.id === id ? { ...e, ...data } : e))
    const updated = next.find(e => e.id === id)
    if (!updated) throw new Error('Expense not found')
    writeStore({ ...store, expenses: next })
    return updated
  },
  deleteExpense: async (id: string): Promise<void> => {
    const store = readStore()
    writeStore({ ...store, expenses: store.expenses.filter(e => e.id !== id) })
  },
}
