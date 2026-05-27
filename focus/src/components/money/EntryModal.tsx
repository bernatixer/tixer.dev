// ============================================
// MONEY ENTRY MODAL — income or expense, create / edit
// ============================================

import { FC, FormEvent, useEffect, useRef, useState } from 'react'
import {
  CATEGORIES,
  formatEURPrecise,
  parseEUR,
  type Cadence,
  type Category,
  type Expense,
  type ExpenseCreate,
  type Income,
  type IncomeCreate,
} from '@/money/types'

const CADENCES: { id: Cadence; label: string; hint: string }[] = [
  { id: 'monthly',   label: 'Monthly',   hint: 'every month' },
  { id: 'weekly',    label: 'Weekly',    hint: 'every week' },
  { id: 'quarterly', label: 'Quarterly', hint: 'every 3 months' },
  { id: 'yearly',    label: 'Yearly',    hint: 'once a year' },
]

interface BaseProps {
  isOpen: boolean
  onClose: () => void
  onDelete?: () => void
}

interface IncomeModalProps extends BaseProps {
  kind: 'income'
  existing?: Income
  onSubmit: (payload: IncomeCreate) => void
}

interface ExpenseModalProps extends BaseProps {
  kind: 'expense'
  existing?: Expense
  onSubmit: (payload: ExpenseCreate) => void
}

type Props = IncomeModalProps | ExpenseModalProps

export const EntryModal: FC<Props> = (props) => {
  const { isOpen, onClose, onDelete, kind } = props
  const existing = props.existing
  const isEdit = !!existing

  const [label, setLabel] = useState('')
  const [amountText, setAmountText] = useState('')
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [category, setCategory] = useState<Category>('other')
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    if (existing) {
      setLabel(existing.label)
      setAmountText(formatEURPrecise(existing.amountCents).replace(/\s?€/, '').trim())
      setCadence(existing.cadence)
      if ('category' in existing) setCategory(existing.category)
    } else {
      setLabel('')
      setAmountText('')
      setCadence('monthly')
      setCategory('other')
    }
    requestAnimationFrame(() => labelRef.current?.focus())
  }, [isOpen, existing])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const amountCents = parseEUR(amountText)
  const valid = label.trim() && amountCents !== null && amountCents > 0

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!valid || amountCents === null) return

    if (kind === 'income') {
      props.onSubmit({
        label: label.trim(),
        amountCents,
        cadence,
      })
    } else {
      props.onSubmit({
        label: label.trim(),
        amountCents,
        cadence,
        category,
      })
    }
  }

  return (
    <div className="new-task-overlay" onClick={onClose}>
      <div className="new-task-card-wrapper" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="task-card variant-active money-modal">
          <div className="money-modal__header">
            <span className="money-modal__heading">
              {isEdit ? `Edit ${kind}` : `New ${kind}`}
            </span>
            <button type="button" className="money-modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <input
            ref={labelRef}
            type="text"
            className="money-modal__label-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={kind === 'income' ? 'e.g. Salary (net)' : 'e.g. Rent'}
          />

          <div className="money-modal__row">
            <span className="money-modal__field-label">Amount</span>
            <div className="money-modal__amount-wrap">
              <input
                type="text"
                inputMode="decimal"
                className="money-modal__amount-input"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="1.234,56"
              />
              <span className="money-modal__amount-suffix">€</span>
            </div>
          </div>

          <div className="money-modal__row">
            <span className="money-modal__field-label">Cadence</span>
            <div className="money-modal__pills">
              {CADENCES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`money-modal__pill ${cadence === c.id ? 'active' : ''}`}
                  onClick={() => setCadence(c.id)}
                  title={c.hint}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {kind === 'expense' && (
            <div className="money-modal__row">
              <span className="money-modal__field-label">Category</span>
              <div className="money-modal__pills money-modal__pills--cats">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`money-modal__pill money-modal__pill--cat ${category === c.id ? 'active' : ''}`}
                    onClick={() => setCategory(c.id)}
                    style={{
                      borderColor: category === c.id ? c.color : undefined,
                      color: category === c.id ? c.color : undefined,
                    }}
                  >
                    <span className="money-modal__cat-dot" style={{ background: c.color }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="money-modal__actions">
            {isEdit && onDelete && (
              <button type="button" onClick={onDelete} className="wg-modal__delete-btn">
                Delete
              </button>
            )}
            <button type="button" onClick={onClose} className="new-task-btn-cancel">
              Cancel
            </button>
            <button type="submit" className="new-task-btn-create" disabled={!valid}>
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
