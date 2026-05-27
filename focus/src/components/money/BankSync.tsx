// ============================================
// BANK SYNC — Enable Banking panel for /money
// ============================================
//
// Three states the panel shows:
//   1. Not configured     — worker is missing ENABLE_BANKING_* env vars.
//   2. Configured, no sessions — show an "Import session" form. User pastes
//      the EB session_id from the dashboard and we ingest its accounts.
//   3. Configured, sessions present — show accounts, sync button, last N tx.

import { FC, useState } from 'react'
import {
  useBankAccounts,
  useBankSessions,
  useBankStatus,
  useDeleteBankSession,
  useStartBankAuth,
  useSyncBank,
} from '@/hooks'
import {
  BANK_CATEGORY_COLORS,
  BANK_CATEGORY_LABEL,
  MANUAL_EXPENSE_PREFIX,
  MANUAL_INCOME_PREFIX,
  daysUntilExpiry,
  effectiveAmountCents,
  formatTxAmount,
  formatTxDate,
  isManualRowId,
  type BankAccount,
  type BankCategory,
  type BankSession,
  type BankTransaction,
} from '@/money/bank'
import type { Expense, Income } from '@/money/types'
import { useUpdateBankTransaction } from '@/hooks'
import { TransactionEditModal } from './TransactionEditModal'
import { CategoryPicker } from './CategoryPicker'
import { TinderCategorizer } from './TinderCategorizer'

interface BankSyncProps {
  enabled: boolean
  // Transactions are fetched once at the parent (MoneyApp) and passed
  // down so InsightsPanel and this table can't disagree on what's there.
  transactions: BankTransaction[]
  manualIncomes?: Income[]
  manualExpenses?: Expense[]
  manualEntriesAsRows?: BankTransaction[]
  onEditManualIncome?: (i: Income) => void
  onEditManualExpense?: (e: Expense) => void
}

export const BankSync: FC<BankSyncProps> = ({
  enabled,
  transactions,
  manualIncomes = [],
  manualExpenses = [],
  manualEntriesAsRows = [],
  onEditManualIncome,
  onEditManualExpense,
}) => {
  const { data: status, isLoading: statusLoading, error: statusError } = useBankStatus(enabled)
  const { data: sessionsData } = useBankSessions(enabled && status?.configured === true)
  const { data: accountsData } = useBankAccounts(enabled && status?.configured === true)

  const sessions = sessionsData?.sessions ?? []
  const accounts = accountsData?.accounts ?? []

  const [tinderOpen, setTinderOpen] = useState(false)

  // Status / loading
  if (!enabled) return null
  if (statusLoading) {
    return (
      <section className="bank-sync">
        <div className="bank-sync__label">BANK SYNC</div>
        <div className="bank-sync__loading">Checking Enable Banking config…</div>
      </section>
    )
  }

  if (statusError) {
    return (
      <section className="bank-sync">
        <div className="bank-sync__label">BANK SYNC</div>
        <div className="bank-sync__error">
          Worker reachable but `/bank/status` errored. Is the worker running on
          {' '}<code>localhost:5555</code>? Check that <code>cd worker && pnpm dev</code> is up.
        </div>
      </section>
    )
  }

  if (!status?.configured) {
    return <NotConfigured />
  }

  if (status.error) {
    return (
      <section className="bank-sync">
        <div className="bank-sync__label">BANK SYNC</div>
        <div className="bank-sync__error">
          Configured, but Enable Banking returned an error: <code>{status.error}</code>
        </div>
      </section>
    )
  }

  return (
    <section className="bank-sync">
      <div className="bank-sync__header">
        <span className="bank-sync__label">BANK SYNC</span>
        {status.app && status.app.environment !== 'PRODUCTION' && (
          <span className={`bank-sync__env bank-sync__env--${status.app.environment.toLowerCase()}`}>
            {status.app.environment}
          </span>
        )}
      </div>

      {sessions.length === 0 ? (
        <ConnectBank />
      ) : (
        <>
          <SessionsAndAccounts
            sessions={sessions}
            accounts={accounts}
            onOpenTinder={() => setTinderOpen(true)}
          />
          <TransactionsList
            transactions={transactions}
            accounts={accounts}
            manualEntriesAsRows={manualEntriesAsRows}
            manualIncomes={manualIncomes}
            manualExpenses={manualExpenses}
            onEditManualIncome={onEditManualIncome}
            onEditManualExpense={onEditManualExpense}
          />
          <TinderCategorizer
            isOpen={tinderOpen}
            transactions={transactions}
            onClose={() => setTinderOpen(false)}
          />
        </>
      )}
    </section>
  )
}

// ============================================
// NOT CONFIGURED
// ============================================

const NotConfigured: FC = () => (
  <section className="bank-sync">
    <div className="bank-sync__label">BANK SYNC</div>
    <div className="bank-sync__empty">
      <p className="bank-sync__empty-title">Enable Banking is not configured.</p>
      <p className="bank-sync__empty-detail">
        Add these to <code>worker/.dev.vars</code> and restart the worker:
      </p>
      <pre className="bank-sync__code">{`ENABLE_BANKING_APP_ID=<your application UUID>
ENABLE_BANKING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
<paste contents of your .pem here>
-----END PRIVATE KEY-----"`}</pre>
      <p className="bank-sync__empty-detail">
        Run <code>cd worker && pnpm dev</code> to start the worker, then refresh.
      </p>
    </div>
  </section>
)

// ============================================
// CONNECT BANK — OAuth flow start
// ============================================

const ConnectBank: FC = () => {
  const { mutate: startAuth, isPending, error } = useStartBankAuth()
  const [aspspName] = useState('Revolut')
  const [aspspCountry] = useState('ES')

  const handleConnect = () => {
    const redirectUrl = `${window.location.origin}/bank/callback`
    startAuth(
      { redirectUrl, aspspName, aspspCountry },
      {
        onSuccess: ({ url }) => {
          window.location.href = url
        },
      },
    )
  }

  return (
    <div className="bank-sync__connect">
      <p className="bank-sync__connect-title">No bank connected yet</p>
      <p className="bank-sync__connect-detail">
        You'll be redirected to <strong>{aspspName}</strong> to confirm access.
        After SCA you come back here and we pull the last 90 days of transactions.
      </p>
      <p className="bank-sync__connect-detail">
        Make sure <code>{window.location.origin}/bank/callback</code> is registered
        as a Redirect URL in your Enable Banking control panel.
      </p>
      <button
        type="button"
        className="bank-sync__btn bank-sync__btn--primary"
        onClick={handleConnect}
        disabled={isPending}
      >
        {isPending ? 'Starting…' : `Connect ${aspspName}`}
      </button>
      {error && (
        <p className="bank-sync__form-error">{(error as Error).message}</p>
      )}
    </div>
  )
}

// ============================================
// SESSIONS + ACCOUNTS
// ============================================

interface SessionsAndAccountsProps {
  sessions: BankSession[]
  accounts: BankAccount[]
  onOpenTinder: () => void
}

const SessionsAndAccounts: FC<SessionsAndAccountsProps> = ({ sessions, accounts, onOpenTinder }) => {
  const { mutate: sync, isPending: syncing, data: syncData, error: syncError } = useSyncBank()
  const { mutate: deleteSession } = useDeleteBankSession()

  return (
    <div className="bank-sync__connected">
      <div className="bank-sync__sessions">
        {sessions.map((s) => {
          const days = daysUntilExpiry(s.validUntil)
          const sessionAccounts = accounts.filter((a) => a.sessionId === s.id)
          return (
            <div key={s.id} className="bank-session bank-session--inline">
              <span className="bank-session__bank">{s.aspspName}</span>
              <span className="bank-session__country">· {s.aspspCountry}</span>
              {sessionAccounts.length === 0 ? (
                <span className="bank-session__no-accounts">· no accounts</span>
              ) : (
                sessionAccounts.map((a) => (
                  <span key={a.id} className="bank-account bank-account--inline">
                    <span className="bank-account__sep">·</span>
                    <span className="bank-account__name">{a.name ?? 'Account'}</span>
                    {a.ibanMasked && <span className="bank-account__iban">{a.ibanMasked}</span>}
                    <span className="bank-account__currency">{a.currency}</span>
                    {a.lastSyncedAt && (
                      <span className="bank-account__synced" title={a.lastSyncedAt}>
                        synced {formatRelative(a.lastSyncedAt)}
                      </span>
                    )}
                  </span>
                ))
              )}
              <span className="bank-session__expiry" title={`Valid until ${s.validUntil}`}>
                Re-auth {days}d
              </span>
              <button
                type="button"
                className="bank-session__delete"
                onClick={() => {
                  if (confirm(`Disconnect ${s.aspspName}? This wipes its stored transactions.`)) {
                    deleteSession(s.id)
                  }
                }}
                title="Disconnect"
              >
                Disconnect
              </button>
            </div>
          )
        })}
      </div>

      <div className="bank-sync__sync-row">
        <button
          type="button"
          className="bank-sync__btn bank-sync__btn--primary"
          onClick={() => sync()}
          disabled={syncing}
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        <button
          type="button"
          className="bank-sync__btn bank-sync__btn--primary"
          onClick={onOpenTinder}
          title="Triage uncategorized transactions one by one"
        >
          Re-categorize
        </button>
        {syncData?.results && syncData.results.length > 0 && (
          <span className="bank-sync__sync-result">
            +{syncData.results.reduce((s, r) => s + r.newTransactions, 0)} new ·{' '}
            {syncData.results.reduce((s, r) => s + r.totalSeen, 0)} seen
          </span>
        )}
        {syncData?.note && <span className="bank-sync__sync-note">{syncData.note}</span>}
        {syncError && <span className="bank-sync__error">{(syncError as Error).message}</span>}
      </div>
    </div>
  )
}

// ============================================
// TRANSACTIONS LIST
// ============================================

interface TransactionsListProps {
  transactions: BankTransaction[]
  accounts: BankAccount[]
  manualEntriesAsRows: BankTransaction[]
  manualIncomes: Income[]
  manualExpenses: Expense[]
  onEditManualIncome?: (i: Income) => void
  onEditManualExpense?: (e: Expense) => void
}

type Direction = 'all' | 'out' | 'in'

const TransactionsList: FC<TransactionsListProps> = ({
  transactions,
  manualEntriesAsRows,
  manualIncomes,
  manualExpenses,
  onEditManualIncome,
  onEditManualExpense,
}) => {
  const [direction, setDirection] = useState<Direction>('all')
  const [hideTransfers, setHideTransfers] = useState(false)
  const [hideHidden, setHideHidden] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<Set<BankCategory>>(new Set())

  const { mutate: updateTx } = useUpdateBankTransaction()

  // Merge bank + manual rows, sort by booking date descending.
  const allRows: BankTransaction[] = [
    ...manualEntriesAsRows,
    ...transactions,
  ].sort((a, b) => b.bookingDate.localeCompare(a.bookingDate))

  const needle = search.trim().toLowerCase()
  const visibleRows = allRows.filter((tx) => {
    const eff = effectiveAmountCents(tx)
    if (direction === 'out' && eff >= 0) return false
    if (direction === 'in' && eff <= 0) return false
    if (hideTransfers && tx.category === 'transfer') return false
    if (hideHidden && tx.excluded) return false
    if (categoryFilter.size > 0 && !categoryFilter.has(tx.category)) return false
    if (needle) {
      const haystack = `${tx.counterparty ?? ''} ${tx.description ?? ''}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  // Categories present in the data, ordered by count desc — only those
  // appear as filter chips so the filter row stays tight.
  const categoryCounts = new Map<BankCategory, number>()
  for (const r of allRows) {
    categoryCounts.set(r.category, (categoryCounts.get(r.category) ?? 0) + 1)
  }
  const availableCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c)

  const toggleCategory = (c: BankCategory) => {
    setCategoryFilter((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  if (transactions.length === 0 && manualEntriesAsRows.length === 0) {
    return (
      <div className="bank-sync__tx-empty">
        No transactions yet. Click <strong>Sync now</strong> to pull from Enable Banking.
      </div>
    )
  }

  const [editing, setEditing] = useState<BankTransaction | null>(null)

  const handleRowClick = (tx: BankTransaction) => {
    if (tx.id.startsWith(MANUAL_INCOME_PREFIX)) {
      const realId = tx.id.slice(MANUAL_INCOME_PREFIX.length)
      const income = manualIncomes.find((i) => i.id === realId)
      if (income && onEditManualIncome) onEditManualIncome(income)
      return
    }
    if (tx.id.startsWith(MANUAL_EXPENSE_PREFIX)) {
      const realId = tx.id.slice(MANUAL_EXPENSE_PREFIX.length)
      const expense = manualExpenses.find((e) => e.id === realId)
      if (expense && onEditManualExpense) onEditManualExpense(expense)
      return
    }
    setEditing(tx)
  }

  return (
    <>
      <div className="bank-tx">
        <div className="bank-tx__filters">
          <div className="bank-tx__filter-group">
            {(['all', 'out', 'in'] as Direction[]).map((d) => (
              <button
                key={d}
                type="button"
                className={`bank-tx__filter-pill ${direction === d ? 'active' : ''}`}
                onClick={() => setDirection(d)}
              >
                {d === 'all' ? 'ALL' : d === 'out' ? 'OUTFLOW' : 'INFLOW'}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="bank-tx__search"
            placeholder="Search counterparty…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="bank-tx__transfer-toggle">
            <input
              type="checkbox"
              checked={hideTransfers}
              onChange={(e) => setHideTransfers(e.target.checked)}
            />
            <span>Hide transfers</span>
          </label>
          <label className="bank-tx__transfer-toggle">
            <input
              type="checkbox"
              checked={hideHidden}
              onChange={(e) => setHideHidden(e.target.checked)}
            />
            <span>Hide excluded</span>
          </label>
          <span className="bank-tx__count">
            {visibleRows.length} of {allRows.length}
          </span>
        </div>

        {availableCategories.length > 1 && (
          <div className="bank-tx__cat-filters">
            {availableCategories.map((c) => {
              const active = categoryFilter.has(c)
              const count = categoryCounts.get(c) ?? 0
              return (
                <button
                  key={c}
                  type="button"
                  className={`bank-tx__cat-chip ${active ? 'active' : ''}`}
                  onClick={() => toggleCategory(c)}
                  style={{
                    borderColor: active ? BANK_CATEGORY_COLORS[c] : undefined,
                    color: active ? BANK_CATEGORY_COLORS[c] : undefined,
                  }}
                >
                  <span className="bank-tx__cat-chip-dot" style={{ background: BANK_CATEGORY_COLORS[c] }} />
                  {BANK_CATEGORY_LABEL[c]}
                  <span className="bank-tx__cat-chip-count">{count}</span>
                </button>
              )
            })}
            {categoryFilter.size > 0 && (
              <button
                type="button"
                className="bank-tx__cat-chip bank-tx__cat-chip--clear"
                onClick={() => setCategoryFilter(new Set())}
                title="Clear category filters"
              >
                ×
              </button>
            )}
          </div>
        )}

        <div className="bank-tx__header">
          <span className="bank-tx__head bank-tx__head--date">DATE</span>
          <span className="bank-tx__head bank-tx__head--cat">CATEGORY</span>
          <span className="bank-tx__head bank-tx__head--cp">COUNTERPARTY</span>
          <span className="bank-tx__head bank-tx__head--amt">AMOUNT</span>
        </div>
        <div className="bank-tx__rows">
          {visibleRows.map((tx) => {
            const eff = effectiveAmountCents(tx)
            const outflow = eff < 0
            const isAdjusted = tx.userAmountCents !== null
            const isManualEntry = isManualRowId(tx.id)
            const dateParts = formatTxDate(tx.bookingDate)
            return (
              <div
                key={tx.id}
                className={`bank-tx__row ${outflow ? 'bank-tx__row--out' : 'bank-tx__row--in'} ${isManualEntry ? 'bank-tx__row--manual' : ''} ${tx.excluded ? 'bank-tx__row--excluded' : ''}`}
                onClick={() => handleRowClick(tx)}
                role="button"
                title={tx.excluded ? 'Hidden from analytics — click to edit' : 'Click to edit'}
              >
                <span className="bank-tx__date">
                  {isManualEntry ? (
                    <span className="bank-tx__manual-badge">MANUAL</span>
                  ) : (
                    <>
                      <span className="bank-tx__date-day">{dateParts.weekday}</span>
                      <span className="bank-tx__date-iso">{dateParts.date}</span>
                    </>
                  )}
                </span>
                <span className="bank-tx__cat" onClick={(e) => e.stopPropagation()}>
                  <CategoryPicker
                    category={tx.category}
                    disabled={isManualEntry || !outflow}
                    onChange={(next) =>
                      updateTx({ id: tx.id, payload: { category: next } })
                    }
                  />
                </span>
                <span className="bank-tx__cp">
                  <span className="bank-tx__cp-name">{tx.counterparty ?? '—'}</span>
                  {tx.description && (
                    <span className="bank-tx__cp-desc" title={tx.description}>
                      {tx.description}
                    </span>
                  )}
                </span>
                <span className={`bank-tx__amt ${outflow ? 'bank-tx__amt--out' : 'bank-tx__amt--in'}`}>
                  {formatTxAmount(eff, tx.currency)}
                  {isAdjusted && (
                    <span className="bank-tx__amt-original" title={`Original: ${formatTxAmount(tx.amountCents, tx.currency)}`}>
                      adj
                    </span>
                  )}
                  {tx.spreadMonths && tx.spreadMonths > 1 && (
                    <span
                      className="bank-tx__amt-spread"
                      title={`Amortized: ${formatTxAmount(Math.round(eff / tx.spreadMonths), tx.currency)}/mo for ${tx.spreadMonths} months`}
                    >
                      ÷{tx.spreadMonths}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <TransactionEditModal tx={editing} onClose={() => setEditing(null)} />
    </>
  )
}

// ============================================
// HELPERS
// ============================================

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return `${Math.floor(diff / 86400_000)}d ago`
}
