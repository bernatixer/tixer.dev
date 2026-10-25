import { useEffect, useRef, useState, type FormEvent } from 'react'
import { del, get, put } from '@/api/client'
import { Food } from './Food'
import { WeightDialog } from './WeightDialog'
import { movingAverage, last, phaseOn, type Meal, type Phase, type WeightEntry } from './model'
import type { MealEstimateJob } from './useMealEstimates'

type DayData = { date: string; meals: Meal[] }

export function DayDrawer({ date, entries, phases, jobs, refreshKey, onAdd, onRetry, onDismiss, onChange, onClose }: {
  date: string; entries: WeightEntry[]; phases: Phase[]; onChange: () => Promise<unknown>; onClose: () => void
  jobs: MealEstimateJob[]; refreshKey: string; onAdd: (text: string, image?: string) => void; onRetry: (id: string) => void; onDismiss: (id: string) => void
}) {
  const original = entries.find(entry => entry.date === date)
  const [data, setData] = useState<DayData | null>(null)
  const [weight, setWeight] = useState(original ? String(original.weightKg) : '')
  const [foodDirty, setFoodDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const daySequence = useRef(0)
  const weightDirty = original ? !weight || Number(weight) !== original.weightKg : !!weight
  useEffect(() => {
    const sequence = ++daySequence.current
    void get<DayData>(`/weight/days/${date}`).then(value => { if (sequence === daySequence.current) setData(value) }, () => { if (sequence === daySequence.current) setError('Could not load this day. Close it and try again.') })
    return () => { daySequence.current++ }
  }, [date, refreshKey])
  const mutate = async (action: Promise<unknown>) => {
    setBusy(true); setError('')
    try {
      await action
    } catch (cause) {
      setError('Could not save. Your changes are still here; try again.')
      setBusy(false)
      throw cause
    }
    // boffin: only the newest day request may replace the meal list.
    const sequence = ++daySequence.current
    const [summary, day] = await Promise.allSettled([onChange(), get<DayData>(`/weight/days/${date}`)])
    if (sequence === daySequence.current) {
      if (day.status === 'fulfilled') setData(day.value)
      if (summary.status === 'rejected' || day.status === 'rejected') setError('Saved, but this view could not refresh. Close and reopen the day to see the latest data.')
    }
    setBusy(false)
  }
  const saveWeight = async (event: FormEvent) => {
    event.preventDefault()
    try { await mutate(put(`/weight/entries/${date}`, { weightKg: Number(weight) })) } catch { /* Draft stays editable. */ }
  }
  const bodyKg = last(movingAverage(entries.filter(entry => entry.date <= date)))
  return <WeightDialog title={date} closeLabel="Close day" dirty={weightDirty || foodDirty} busy={busy} onClose={onClose}>
    <p className="finance-muted">Daily record · food uses its assigned day, including the 02:00 rollover.</p>
    {error && <p role="alert" className="finance-danger">{error}</p>}
    <form onSubmit={saveWeight}><fieldset disabled={busy} className="weight-form"><label className="finance-field">Weight (kg)<input type="number" inputMode="decimal" min="20" max="400" step="0.05" required value={weight} onChange={event => setWeight(event.target.value)} /></label><div className="weight-plan__actions"><button type="submit" disabled={!weightDirty}>Save weight</button>{original && <button type="button" className="finance-remove" onClick={() => { if (window.confirm(`Delete the weigh-in for ${date}?`)) void mutate(del(`/weight/entries/${date}`)).then(() => setWeight('')).catch(() => undefined) }}>Delete weigh-in</button>}</div></fieldset></form>
    {data ? <fieldset disabled={busy} className="weight-food-editor"><Food title={`FOOD · ${date}`} meals={data.meals} jobs={jobs} knownTotal={data.meals.length > 0} phase={phaseOn(phases, date)} bodyKg={bodyKg} onDirty={setFoodDirty}
        onAdd={onAdd} onRetry={onRetry} onDismiss={onDismiss}
        onUpdate={(id, kcal) => mutate(put(`/meals/${id}`, { kcal }))} onDelete={id => mutate(del(`/meals/${id}`))} /></fieldset>
      : !error && <p>Loading food…</p>}
  </WeightDialog>
}
