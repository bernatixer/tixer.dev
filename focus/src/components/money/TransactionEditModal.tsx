// ============================================
// TRANSACTION EDIT MODAL
// ============================================
//
// Lets the user override the auto-derived category and/or set an
// "actual amount" for splits/reimbursements. Manual decisions write to
// the per-merchant cache (when "apply to merchant" is on) so future
// transactions from the same counterparty adopt the same category.

import { FC, FormEvent, useEffect, useState } from 'react'
import { useUpdateBankTransaction } from '@/hooks'
import {
  BANK_CATEGORY_COLORS,
  BANK_CATEGORY_LABEL,
  effectiveAmountCents,
  formatTxAmount,
  type BankCategory,
  type BankTransaction,
} from '@/money/bank'
import { parseEUR, formatEURPrecise } from '@/money/types'

const ALL_CATEGORIES: BankCategory[] = [
  'food', 'transport', 'housing', 'clothing', 'beauty', 'decoration', 'travel',
  'leisure', 'gifts', 'fitness', 'investment',
]

interface Props {
  tx: BankTransaction | null
  onClose: () => void
}

export const TransactionEditModal: FC<Props> = ({ tx, onClose }) => {
  const { mutate: update, isPending, error } = useUpdateBankTransaction()
  const [category, setCategory] = useState<BankCategory>('other')
  const [adjustEnabled, setAdjustEnabled] = useState(false)
  const [adjustText, setAdjustText] = useState('')
  const [excluded, setExcluded] = useState(false)
  const [spreadEnabled, setSpreadEnabled] = useState(false)
  const [spreadMonths, setSpreadMonths] = useState(3)

  useEffect(() => {
    if (!tx) return
    setCategory(tx.category)
    setAdjustEnabled(tx.userAmountCents !== null)
    setAdjustText(
      tx.userAmountCents !== null
        ? formatEURPrecise(Math.abs(tx.userAmountCents)).replace(/\s?€/, '').trim()
        : '',
    )
    setExcluded(tx.excluded)
    setSpreadEnabled(!!tx.spreadMonths && tx.spreadMonths > 1)
    setSpreadMonths(tx.spreadMonths && tx.spreadMonths > 1 ? tx.spreadMonths : 3)
  }, [tx])

  useEffect(() => {
    if (!tx) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [tx, onClose])

  if (!tx) return null

  const outflow = tx.amountCents < 0
  const isAdjusted = tx.userAmountCents !== null
  const effective = effectiveAmountCents(tx)

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    const categoryChanged = category !== tx.category
    const excludedChanged = excluded !== tx.excluded
    let userAmountCents: number | null | undefined = undefined
    if (adjustEnabled) {
      const parsed = parseEUR(adjustText)
      if (parsed === null) return
      // Preserve the sign of the original transaction
      userAmountCents = outflow ? -Math.abs(parsed) : Math.abs(parsed)
    } else if (isAdjusted) {
      userAmountCents = null // clear override
    }

    // Spread: null to clear, integer >1 to set
    let spreadPayload: number | null | undefined = undefined
    const desiredSpread = spreadEnabled && spreadMonths > 1 ? spreadMonths : null
    if (desiredSpread !== (tx.spreadMonths ?? null)) {
      spreadPayload = desiredSpread
    }

    update(
      {
        id: tx.id,
        payload: {
          ...(categoryChanged ? { category } : {}),
          ...(userAmountCents !== undefined ? { userAmountCents } : {}),
          ...(excludedChanged ? { excluded } : {}),
          ...(spreadPayload !== undefined ? { spreadMonths: spreadPayload } : {}),
        },
      },
      {
        onSuccess: () => onClose(),
      },
    )
  }

  return (
    <div className="new-task-overlay" onClick={onClose}>
      <div className="new-task-card-wrapper" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="task-card variant-active money-modal tx-edit-modal">
          <div className="money-modal__header">
            <span className="money-modal__heading">EDIT TRANSACTION</span>
            <div className="money-modal__header-actions">
              <button
                type="button"
                className={`tx-edit-modal__eye ${excluded ? 'is-hidden' : ''}`}
                onClick={() => setExcluded((v) => !v)}
                title={
                  excluded
                    ? 'Currently hidden from analytics — click to show'
                    : 'Click to hide from analytics (stays visible in this table)'
                }
                aria-label={excluded ? 'Show in analytics' : 'Hide from analytics'}
              >
                {excluded ? (
                  /* eye-off */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* eye */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
              <button type="button" className="money-modal__close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
          </div>

          <div className="tx-edit-modal__summary">
            <span className="tx-edit-modal__date">{tx.bookingDate}</span>
            <span className="tx-edit-modal__cp">{tx.counterparty ?? '—'}</span>
            <span className={`tx-edit-modal__amt ${outflow ? 'tx-edit-modal__amt--out' : 'tx-edit-modal__amt--in'}`}>
              {formatTxAmount(tx.amountCents, tx.currency)}
            </span>
          </div>
          {tx.description && tx.description !== tx.counterparty && (
            <div className="tx-edit-modal__desc">{tx.description}</div>
          )}

          {/* CATEGORY — only meaningful for expense (outgoing) transactions.
              Positive amounts are auto-counted as income; nothing to pick. */}
          {outflow ? (
            <div className="tx-edit-modal__field">
              <span className="money-modal__field-label">Category</span>
              <div className="tx-edit-modal__cats">
                {ALL_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`money-modal__pill money-modal__pill--cat ${category === c ? 'active' : ''}`}
                    onClick={() => setCategory(c)}
                    style={{
                      borderColor: category === c ? BANK_CATEGORY_COLORS[c] : undefined,
                      color: category === c ? BANK_CATEGORY_COLORS[c] : undefined,
                    }}
                  >
                    <span className="money-modal__cat-dot" style={{ background: BANK_CATEGORY_COLORS[c] }} />
                    {BANK_CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="tx-edit-modal__field tx-edit-modal__income-note">
              <span className="money-modal__field-label">Category</span>
              <span className="tx-edit-modal__income-pill">
                <span className="money-modal__cat-dot" style={{ background: BANK_CATEGORY_COLORS.income }} />
                INCOME · automatic
              </span>
            </div>
          )}

          {/* ADJUSTED AMOUNT (splits / reimbursements) */}
          <label className="tx-edit-modal__toggle">
            <input
              type="checkbox"
              checked={adjustEnabled}
              onChange={(e) => setAdjustEnabled(e.target.checked)}
            />
            <span>Adjust amount (split with someone, partial reimbursement)</span>
          </label>

          {adjustEnabled && (
            <div className="money-modal__row tx-edit-modal__adjust">
              <span className="money-modal__field-label">Actual {outflow ? 'spent' : 'received'}</span>
              <div className="money-modal__amount-wrap">
                <input
                  type="text"
                  inputMode="decimal"
                  className="money-modal__amount-input"
                  value={adjustText}
                  onChange={(e) => setAdjustText(e.target.value)}
                  placeholder={(Math.abs(tx.amountCents) / 100).toFixed(2)}
                />
                <span className="money-modal__amount-suffix">€</span>
              </div>
              <div className="tx-edit-modal__split-helpers">
                {[
                  { label: '1/4', frac: 0.25 },
                  { label: '1/3', frac: 1 / 3 },
                  { label: '1/2', frac: 0.5 },
                  { label: '2/3', frac: 2 / 3 },
                  { label: '3/4', frac: 0.75 },
                ].map((h) => (
                  <button
                    key={h.label}
                    type="button"
                    className="tx-edit-modal__split-pill"
                    onClick={() => {
                      const portion = Math.abs(tx.amountCents) * h.frac
                      setAdjustText((portion / 100).toFixed(2))
                    }}
                    title={`Set to ${h.label} of original (${formatTxAmount(Math.abs(tx.amountCents) * h.frac * (outflow ? -1 : 1), tx.currency)})`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              {adjustText && parseEUR(adjustText) !== null && (
                <span className="tx-edit-modal__adjust-note">
                  Originally {formatTxAmount(tx.amountCents, tx.currency)}
                </span>
              )}
            </div>
          )}

          {!adjustEnabled && isAdjusted && (
            <div className="tx-edit-modal__adjust-note">
              Currently overridden: {formatTxAmount(effective, tx.currency)} (original {formatTxAmount(tx.amountCents, tx.currency)}).
              Uncheck and save to clear.
            </div>
          )}

          <label className="tx-edit-modal__toggle">
            <input
              type="checkbox"
              checked={spreadEnabled}
              onChange={(e) => setSpreadEnabled(e.target.checked)}
            />
            <span>Spread amount over multiple months (treatments, annual bills…)</span>
          </label>

          {spreadEnabled && (
            <div className="money-modal__row tx-edit-modal__adjust">
              <span className="money-modal__field-label">Months</span>
              <div className="tx-edit-modal__spread-controls">
                <button
                  type="button"
                  onClick={() => setSpreadMonths((n) => Math.max(2, n - 1))}
                  className="wg-modal__counter-btn"
                  disabled={spreadMonths <= 2}
                >
                  −
                </button>
                <span className="wg-modal__counter-value">{spreadMonths}</span>
                <button
                  type="button"
                  onClick={() => setSpreadMonths((n) => Math.min(120, n + 1))}
                  className="wg-modal__counter-btn"
                >
                  +
                </button>
              </div>
              <span className="tx-edit-modal__adjust-note">
                {formatTxAmount(
                  outflow
                    ? -Math.round(Math.abs(effective) / spreadMonths)
                    : Math.round(Math.abs(effective) / spreadMonths),
                  tx.currency,
                )}{' '}
                / month across {spreadMonths} months from {tx.bookingDate}
              </span>
            </div>
          )}

          {error && (
            <p className="bank-sync__form-error">{(error as Error).message}</p>
          )}

          <div className="money-modal__actions">
            <button type="button" onClick={onClose} className="new-task-btn-cancel">
              Cancel
            </button>
            <button
              type="submit"
              className="new-task-btn-create"
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
