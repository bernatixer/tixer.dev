// ============================================
// TINDER CATEGORIZER
// ============================================
//
// One transaction at a time. Big card with all the info, a grid of
// category pills, plus skip/hide actions. Tap a category → saves and
// advances. Default queue: everything still labeled `other`.
//
// We deliberately don't track an `index` here — the server-side queue
// (transactions where category='other') shrinks as we tag rows, and
// React Query refetches after every mutation. To avoid double-advance
// races between our local index and the refresh, we keep local
// `completed` and `skipped` ID sets and always render the first row
// that isn't in either set.

import { FC, useEffect, useMemo, useState } from 'react'
import { useUpdateBankTransaction } from '@/hooks'
import {
  BANK_CATEGORY_COLORS,
  BANK_CATEGORY_LABEL,
  effectiveAmountCents,
  formatTxAmount,
  formatTxDate,
  isManualRowId,
  type BankCategory,
  type BankTransaction,
} from '@/money/bank'

const CATEGORY_ORDER: BankCategory[] = [
  'food',
  'transport',
  'housing',
  'clothing',
  'beauty',
  'decoration',
  'travel',
  'leisure',
  'gifts',
  'fitness',
  'investment',
]

interface Props {
  isOpen: boolean
  transactions: BankTransaction[]
  onClose: () => void
}

export const TinderCategorizer: FC<Props> = ({ isOpen, transactions, onClose }) => {
  const { mutate: updateTx } = useUpdateBankTransaction()
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [skipped, setSkipped] = useState<Set<string>>(new Set())

  // Base queue: untyped rows, newest first, no manual entries, no
  // already-hidden rows.
  const baseQueue = useMemo(
    () =>
      transactions
        .filter((t) => t.category === 'other' && !isManualRowId(t.id) && !t.excluded)
        .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate)),
    [transactions],
  )

  // What we actually render: filter out items the user has already
  // touched in this session (completed = saved, skipped = passed on).
  const displayQueue = baseQueue.filter(
    (t) => !completed.has(t.id) && !skipped.has(t.id),
  )

  // Reset session state every time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setCompleted(new Set())
      setSkipped(new Set())
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const current = displayQueue[0]
  const totalProcessed = completed.size
  const totalInitial = baseQueue.length + totalProcessed

  const handlePick = (cat: BankCategory) => {
    if (!current) return
    setCompleted((prev) => {
      const next = new Set(prev)
      next.add(current.id)
      return next
    })
    updateTx({ id: current.id, payload: { category: cat } })
  }

  const handleHide = () => {
    if (!current) return
    setCompleted((prev) => {
      const next = new Set(prev)
      next.add(current.id)
      return next
    })
    updateTx({ id: current.id, payload: { excluded: true } })
  }

  const handleSkip = () => {
    if (!current) return
    setSkipped((prev) => {
      const next = new Set(prev)
      next.add(current.id)
      return next
    })
  }

  const allDone = !current

  const eff = current ? effectiveAmountCents(current) : 0
  const outflow = eff < 0
  const dateParts = current ? formatTxDate(current.bookingDate) : { weekday: '', date: '' }

  return (
    <div className="new-task-overlay" onClick={onClose}>
      <div className="new-task-card-wrapper" onClick={(e) => e.stopPropagation()}>
        <div className="task-card variant-active tinder-modal">
          <div className="tinder-modal__header">
            <span className="tinder-modal__heading">
              CATEGORIZE · {totalProcessed + 1} of {Math.max(totalInitial, 1)}
            </span>
            <button
              type="button"
              className="money-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {allDone ? (
            <div className="tinder-modal__done">
              <div className="tinder-modal__done-mark">✓</div>
              <p className="tinder-modal__done-title">All caught up</p>
              <p className="tinder-modal__done-detail">
                {totalInitial === 0
                  ? 'No uncategorized transactions to triage.'
                  : `You categorized ${totalProcessed} transaction${totalProcessed === 1 ? '' : 's'}${
                      skipped.size > 0 ? ` (skipped ${skipped.size})` : ''
                    }.`}
              </p>
              <button type="button" className="new-task-btn-create" onClick={onClose}>
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="tinder-modal__card">
                <div className="tinder-modal__date-row">
                  <span className="tinder-modal__weekday">{dateParts.weekday}</span>
                  <span className="tinder-modal__date">{dateParts.date}</span>
                </div>
                <div className="tinder-modal__counterparty">
                  {current.counterparty ?? '—'}
                </div>
                {current.description && current.description !== current.counterparty && (
                  <div className="tinder-modal__description" title={current.description}>
                    {current.description}
                  </div>
                )}
                <div
                  className={`tinder-modal__amount ${outflow ? 'tinder-modal__amount--out' : 'tinder-modal__amount--in'}`}
                >
                  {formatTxAmount(eff, current.currency)}
                </div>
              </div>

              <div className="tinder-modal__categories">
                {CATEGORY_ORDER.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="tinder-modal__cat-btn"
                    onClick={() => handlePick(c)}
                    style={{
                      borderColor: BANK_CATEGORY_COLORS[c],
                    }}
                  >
                    <span
                      className="tinder-modal__cat-dot"
                      style={{ background: BANK_CATEGORY_COLORS[c] }}
                    />
                    <span>{BANK_CATEGORY_LABEL[c]}</span>
                  </button>
                ))}
              </div>

              <div className="tinder-modal__actions">
                <button type="button" className="tinder-modal__skip" onClick={handleSkip}>
                  Skip
                </button>
                <button type="button" className="tinder-modal__hide" onClick={handleHide}>
                  Hide from analytics
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
