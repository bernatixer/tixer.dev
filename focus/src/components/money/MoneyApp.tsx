// ============================================
// MONEY APP — POC dashboard
// ============================================

import { FC, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import {
  useAuthSync,
  useBankTransactions,
  useCreateExpense,
  useCreateIncome,
  useDeleteExpense,
  useDeleteIncome,
  useMoneySnapshot,
  useUpdateExpense,
  useUpdateIncome,
} from '@/hooks'
import { aggregateBankToMonthly, manualEntriesAsTransactions } from '@/money/bank'
import { useTheme } from '@/hooks/useTheme'
import {
  formatEUR,
  monthlyTotal,
  type Expense,
  type Income,
} from '@/money/types'
import { SignInPage } from '../todo/SignInPage'
import { EntryModal } from './EntryModal'
import { Sankey } from './Sankey'
import { DonutChart } from './DonutChart'
import { BankSync } from './BankSync'
import { InsightsPanel } from './InsightsPanel'
import '@/styles/todo.css'
import '@/styles/money.css'

// ============================================
// THEME TOGGLE — slim copy of focus header version
// ============================================

const ThemeToggle: FC = () => {
  const { themeId, toggle } = useTheme()
  const isDark = themeId === 'cyberDark'
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}

// ============================================
// HEADER
// ============================================

interface HeaderProps {
  onAddIncome: () => void
  onAddExpense: () => void
}

const MoneyHeader: FC<HeaderProps> = ({ onAddIncome, onAddExpense }) => {
  return (
    <header className="todo-header">
      <div className="header-left">
        <h1 className="todo-title">
          <svg className="todo-title-logo" width="22" height="22" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="money-ring" x1="72" y1="54" x2="196" y2="214" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#5A5A5A" />
                <stop offset="0.55" stopColor="#454545" />
                <stop offset="1" stopColor="#3E3E3E" />
              </linearGradient>
            </defs>
            <path
              d="M 205.055 99.954 A 82 82 0 1 1 150.602 49.177"
              stroke="url(#money-ring)"
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="186.690" cy="69.310" r="22" fill="#BFFF00" />
          </svg>
          Money
        </h1>
        <nav className="nav-switcher">
          <Link to="/" className="nav-switcher__link">FOCUS</Link>
          <span className="nav-switcher__sep">·</span>
          <span className="nav-switcher__link nav-switcher__link--active">MONEY</span>
        </nav>
      </div>
      <div className="header-controls">
        <button className="header-btn" onClick={onAddIncome}>+ Income</button>
        <button className="btn-new-task" onClick={onAddExpense}>New Expense</button>
        <ThemeToggle />
        <UserButton appearance={{ elements: { avatarBox: 'user-avatar' } }} />
      </div>
    </header>
  )
}

// ============================================
// STATS BAR
// ============================================

interface StatsProps {
  income: number
  expenses: number
  savings: number
  monthLabel: string
}

// Hardcoded hard rule for now — half of every euro of income should
// be saved. Keep in sync with whatever target the user later configures.
const SAVINGS_GOAL_PCT = 0.5

const StatsBar: FC<StatsProps> = ({ income, expenses, savings, monthLabel }) => {
  const rate = income > 0 ? savings / income : 0
  const overspend = savings < 0
  const rateLabel = income === 0 ? '—' : `${(rate * 100).toFixed(0)}%`
  const goalProgress = income > 0 ? rate / SAVINGS_GOAL_PCT : 0
  const fillPct = Math.max(0, Math.min(1, goalProgress)) * 100
  const meetsGoal = rate >= SAVINGS_GOAL_PCT
  const closeToGoal = !meetsGoal && rate >= SAVINGS_GOAL_PCT * 0.8

  return (
    <div className="stats-bar">
      <div className="stat-cell">
        <span className="stat-cell__label">INCOME · {monthLabel}</span>
        <span className="stat-cell__value">{formatEUR(income)}</span>
      </div>
      <div className="stat-cell">
        <span className="stat-cell__label">EXPENSES · {monthLabel}</span>
        <span className="stat-cell__value">{formatEUR(expenses)}</span>
      </div>
      <div className={`stat-cell ${overspend ? 'stat-cell--danger' : 'stat-cell--positive'}`}>
        <span className="stat-cell__label">
          {overspend ? 'OVERSPEND' : 'SAVINGS'}
          <span className="stat-cell__rate">{rateLabel}</span>
        </span>
        <span className="stat-cell__value">{formatEUR(Math.abs(savings))}</span>
        {!overspend && income > 0 && (
          <span
            className={`stat-cell__goal ${meetsGoal ? 'stat-cell__goal--met' : closeToGoal ? 'stat-cell__goal--close' : 'stat-cell__goal--off'}`}
          >
            <span className="stat-cell__goal-bar">
              <span className="stat-cell__goal-fill" style={{ width: `${fillPct}%` }} />
            </span>
            <span className="stat-cell__goal-text">
              Goal {Math.round(SAVINGS_GOAL_PCT * 100)}% ·{' '}
              {meetsGoal
                ? `+${Math.round((rate - SAVINGS_GOAL_PCT) * 100)}%`
                : `${Math.round((rate - SAVINGS_GOAL_PCT) * 100)}%`}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================
// MAIN CONTENT
// ============================================

const MoneyContent: FC = () => {
  const { isReady } = useAuthSync()
  const { data, isLoading } = useMoneySnapshot(isReady)
  const { data: txData } = useBankTransactions(isReady, 500)
  const { mutate: createIncome } = useCreateIncome()
  const { mutate: updateIncome } = useUpdateIncome()
  const { mutate: deleteIncome } = useDeleteIncome()
  const { mutate: createExpense } = useCreateExpense()
  const { mutate: updateExpense } = useUpdateExpense()
  const { mutate: deleteExpense } = useDeleteExpense()

  const [addingIncome, setAddingIncome] = useState(false)
  const [addingExpense, setAddingExpense] = useState(false)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  // Prefer real bank data when we have it; fall back to the manual /
  // mock-seeded snapshot otherwise. The visualizations don't care which
  // source they came from — the shape is the same.
  // NB: this useMemo must live ABOVE any conditional early-return below,
  // otherwise hook order changes between renders and React throws.
  const bankAgg = useMemo(
    () => aggregateBankToMonthly(txData?.transactions ?? []),
    [txData?.transactions],
  )

  if (!isReady) {
    return <div className="loading">Loading...</div>
  }

  const usingBankData = bankAgg.transactionCount > 0

  // Combine bank-derived rows with the user's manually-added ones.
  // Manual entries are useful for things the bank doesn't see (cash income,
  // investments outside the linked account, side-hustle revenue, etc.) and
  // simply add on top of whatever the bank reports.
  const manualIncomes = data?.incomes ?? []
  const manualExpenses = data?.expenses ?? []
  const incomes = usingBankData ? [...bankAgg.incomes, ...manualIncomes] : manualIncomes
  const expenses = usingBankData ? [...bankAgg.expenses, ...manualExpenses] : manualExpenses

  const incomeMonthly = monthlyTotal(incomes)
  const expenseMonthly = monthlyTotal(expenses)
  // Investments are wealth-building outflows, not consumed spending. They
  // appear in the Sankey/Donut as their own slice but the SAVINGS number
  // and rate treat them as money you kept (you can still touch it).
  const investmentMonthly = monthlyTotal(expenses.filter((e) => e.category === 'investment'))
  const spendingMonthly = expenseMonthly - investmentMonthly
  const savings = incomeMonthly - spendingMonthly

  return (
    <>
      <MoneyHeader
        onAddIncome={() => setAddingIncome(true)}
        onAddExpense={() => setAddingExpense(true)}
      />

      {isLoading && expenses.length === 0 ? (
        <div className="money-loading">Loading…</div>
      ) : (
        <>
          <StatsBar
            income={incomeMonthly}
            expenses={spendingMonthly}
            savings={savings}
            monthLabel={bankAgg.monthLabel}
          />
          <div className="flow-row">
            <Sankey incomes={incomes} expenses={expenses} />
            <DonutChart expenses={expenses} />
          </div>
          <InsightsPanel
            transactions={txData?.transactions ?? []}
            currentMonth={bankAgg.month}
          />
          <BankSync
            enabled={isReady}
            transactions={txData?.transactions ?? []}
            manualIncomes={manualIncomes}
            manualExpenses={manualExpenses}
            manualEntriesAsRows={manualEntriesAsTransactions(manualIncomes, manualExpenses)}
            onEditManualIncome={setEditingIncome}
            onEditManualExpense={setEditingExpense}
          />
        </>
      )}

      <EntryModal
        kind="income"
        isOpen={addingIncome}
        onClose={() => setAddingIncome(false)}
        onSubmit={(payload) => {
          createIncome(payload)
          setAddingIncome(false)
        }}
      />

      <EntryModal
        kind="expense"
        isOpen={addingExpense}
        onClose={() => setAddingExpense(false)}
        onSubmit={(payload) => {
          createExpense(payload)
          setAddingExpense(false)
        }}
      />

      <EntryModal
        kind="income"
        isOpen={!!editingIncome}
        existing={editingIncome ?? undefined}
        onClose={() => setEditingIncome(null)}
        onDelete={() => {
          if (editingIncome) {
            deleteIncome(editingIncome.id)
            setEditingIncome(null)
          }
        }}
        onSubmit={(payload) => {
          if (editingIncome) {
            updateIncome({ id: editingIncome.id, data: payload })
          }
          setEditingIncome(null)
        }}
      />

      <EntryModal
        kind="expense"
        isOpen={!!editingExpense}
        existing={editingExpense ?? undefined}
        onClose={() => setEditingExpense(null)}
        onDelete={() => {
          if (editingExpense) {
            deleteExpense(editingExpense.id)
            setEditingExpense(null)
          }
        }}
        onSubmit={(payload) => {
          if (editingExpense) {
            updateExpense({ id: editingExpense.id, data: payload })
          }
          setEditingExpense(null)
        }}
      />
    </>
  )
}

// ============================================
// MONEY APP
// ============================================

export const MoneyApp: FC = () => {
  useEffect(() => {
    document.title = 'FOCUS · MONEY'
  }, [])

  return (
    <>
      <SignedOut>
        <SignInPage />
      </SignedOut>
      <SignedIn>
        <div className="todo-container">
          <MoneyContent />
        </div>
      </SignedIn>
    </>
  )
}
