import { useEffect, useRef, useState } from 'react'
import { del, get, put } from '@/api/client'
import { Food } from './Food'
import { WeightDialog } from './WeightDialog'
import { movingAverage, last, type Meal, type WeightEntry } from './model'
import type { MealEstimateJob } from './useMealEstimates'
import { formatWeightDate } from './format'

type DayData = { date: string; meals: Meal[] }

export function DayDrawer({ date, entries, kcalTarget, jobs, refreshKey, onAdd, onRetry, onDismiss, onChange, onClose }: {
  date: string; entries: WeightEntry[]; kcalTarget?: number | null; onChange: () => Promise<unknown>; onClose: () => void
  jobs: MealEstimateJob[]; refreshKey: string; onAdd: (text: string, image?: string) => void; onRetry: (id: string) => void; onDismiss: (id: string) => void
}) {
  const [data, setData] = useState<DayData | null>(null)
  const [foodDirty, setFoodDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const daySequence = useRef(0)
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
  const bodyKg = last(movingAverage(entries.filter(entry => entry.date <= date)))
  return <WeightDialog title={formatWeightDate(date)} closeLabel="Close day" dirty={foodDirty} busy={busy} onClose={onClose}>
    {error && <p role="alert" className="finance-danger">{error}</p>}
    {data ? <fieldset disabled={busy} className="weight-food-editor"><Food title="FOOD" meals={data.meals} jobs={jobs} knownTotal={data.meals.length > 0} kcalTarget={kcalTarget} bodyKg={bodyKg} onDirty={setFoodDirty}
        onAdd={onAdd} onRetry={onRetry} onDismiss={onDismiss}
        onUpdate={(id, kcal) => mutate(put(`/meals/${id}`, { kcal }))} onDelete={id => mutate(del(`/meals/${id}`))} /></fieldset>
      : !error && <p>Loading food…</p>}
  </WeightDialog>
}
