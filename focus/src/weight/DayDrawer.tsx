import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, del, get, post, put } from '@/api/client'
import { Food } from './Food'
import { WeightDialog } from './WeightDialog'
import { localToday, mealDay, movingAverage, last, phaseOn, type Meal, type Phase, type WeightEntry } from './model'

type DayData = { date: string; meals: Meal[]; revision: number; confirmedRevision: number | null }

export function DayDrawer({ date, entries, phases, onChange, onClose }: {
  date: string; entries: WeightEntry[]; phases: Phase[]; onChange: () => Promise<unknown>; onClose: () => void
}) {
  const original = entries.find(entry => entry.date === date)
  const [data, setData] = useState<DayData | null>(null)
  const [weight, setWeight] = useState(original ? String(original.weightKg) : '')
  const [description, setDescription] = useState(''), [calories, setCalories] = useState('')
  const [foodDirty, setFoodDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const weightDirty = original ? !weight || Number(weight) !== original.weightKg : !!weight
  useEffect(() => {
    let active = true
    void get<DayData>(`/weight/days/${date}`).then(value => { if (active) setData(value) }, () => { if (active) setError('Could not load this day. Close it and try again.') })
    return () => { active = false }
  }, [date])
  const mutate = async (action: Promise<unknown>) => {
    setBusy(true); setError('')
    try {
      await action
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409 ? 'Food changed since you opened this day. Close and reopen it to review the latest totals.' : 'Could not save. Your changes are still here; try again.')
      setBusy(false)
      throw cause
    }
    // boffin: a failed refresh cannot turn a saved meal into a retryable submission.
    const [summary, day] = await Promise.allSettled([onChange(), get<DayData>(`/weight/days/${date}`)])
    if (day.status === 'fulfilled') setData(day.value)
    if (summary.status === 'rejected' || day.status === 'rejected') setError('Saved, but this view could not refresh. Close and reopen the day to see the latest data.')
    setBusy(false)
  }
  const saveWeight = async (event: FormEvent) => {
    event.preventDefault()
    try { await mutate(put(`/weight/entries/${date}`, { weightKg: Number(weight) })) } catch { /* Draft stays editable. */ }
  }
  const saveMeal = async (event: FormEvent) => {
    event.preventDefault()
    try { await mutate(post('/meals', { date, description, kcal: Number(calories) })); setDescription(''); setCalories('') } catch { /* Draft stays editable. */ }
  }
  const review = async () => {
    if (!data) return
    try { await mutate(put('/weight/day-reviews', { days: [{ date, revision: data.revision }], complete: data.confirmedRevision !== data.revision, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })) } catch { /* The error is shown beside the confirmation. */ }
  }
  const bodyKg = last(movingAverage(entries.filter(entry => entry.date <= date)))
  return <WeightDialog title={date} closeLabel="Close day" dirty={weightDirty || !!description || !!calories || foodDirty} busy={busy} onClose={onClose}>
    <p className="finance-muted">Daily record · food uses its assigned day, including the 02:00 rollover.</p>
    {error && <p role="alert" className="finance-danger">{error}</p>}
    <form onSubmit={saveWeight}><fieldset disabled={busy} className="weight-form"><label className="finance-field">Weight (kg)<input type="number" inputMode="decimal" min="20" max="400" step="0.05" required value={weight} onChange={event => setWeight(event.target.value)} /></label><div className="weight-plan__actions"><button type="submit" disabled={!weightDirty}>Save weight</button>{original && <button type="button" className="finance-remove" onClick={() => { if (window.confirm(`Delete the weigh-in for ${date}?`)) void mutate(del(`/weight/entries/${date}`)).then(() => setWeight('')).catch(() => undefined) }}>Delete weigh-in</button>}</div></fieldset></form>
    {data ? <>
      <fieldset disabled={busy} className="weight-food-editor"><Food title={`FOOD · ${date}`} meals={data.meals} knownTotal={data.meals.length > 0 || data.confirmedRevision === data.revision} phase={phaseOn(phases, date)} bodyKg={bodyKg} onDirty={setFoodDirty}
        onAdd={(text, image) => mutate(post('/meals', { text, image, date, language: navigator.language }))}
        onUpdate={(id, kcal) => mutate(put(`/meals/${id}`, { kcal }))} onDelete={id => mutate(del(`/meals/${id}`))} /></fieldset>
      <form onSubmit={saveMeal} className="weight-manual"><h3>Add known calories</h3><p className="finance-muted">Add missing food directly, without using an AI estimate.</p><fieldset disabled={busy} className="weight-form">
        <label className="finance-field">Meal description<input required maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="Lunch, a snack, a forgotten drink…" /></label>
        <label className="finance-field">Known calories (kcal)<input type="number" inputMode="numeric" min="0" max="10000" step="1" required value={calories} onChange={event => setCalories(event.target.value)} /></label>
        <button type="submit" className="finance-primary">Save meal</button>
      </fieldset></form>
      <section className="weight-day__review"><h3>Food coverage</h3><p className="finance-muted">{date >= mealDay() ? 'This food day is still in progress.' : 'Confirm only when all food for this day is recorded. Editing a meal asks you to review it again.'}</p>
        {data.confirmedRevision === data.revision && <p className="weight-stat--good">Food log reviewed</p>}
        <button type="button" disabled={busy || date >= mealDay() || date > localToday()} onClick={() => void review()}>{data.confirmedRevision === data.revision ? 'Mark food log incomplete' : 'Confirm food log complete'}</button>
      </section>
    </> : !error && <p>Loading food…</p>}
  </WeightDialog>
}
