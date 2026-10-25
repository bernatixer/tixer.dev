import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DEFAULT_PROTEIN_PER_KG, type Meal, type Phase } from './model'
import type { MealEstimateJob } from './useMealEstimates'

// Phone photos are several MB; 1024px JPEG is plenty for estimating a plate.
async function shrinkPhoto(file: File, maxSide = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Eases a number towards its new value so totals tick up instead of jumping.
function useCountUp(target: number, ms = 600) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now(), origin = from.current
    if (origin === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = target; setValue(target); return }
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / ms), eased = 1 - (1 - t) ** 3
      setValue(Math.round(origin + (target - origin) * eased)); from.current = Math.round(origin + (target - origin) * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, ms])
  return value
}

const NUTRIENT_LABELS = [['carbsG', 'Carbs'], ['fatG', 'Fat'], ['saturatedG', 'Sat. fat'], ['fibreG', 'Fibre'], ['sugarG', 'Sugar']] as const

export function Food({ meals, phase, bodyKg, jobs = [], onAdd, onRetry, onDismiss, onUpdate, onDelete, title = 'FOOD · TODAY', onDirty, knownTotal = true }: { meals: Meal[]; phase?: Phase; bodyKg?: number; jobs?: MealEstimateJob[]; onAdd: (text: string, image?: string) => void; onRetry?: (id: string) => void; onDismiss?: (id: string) => void; onUpdate: (id: string, kcal: number) => Promise<unknown>; onDelete: (id: string) => Promise<unknown>; title?: string; onDirty?: (dirty: boolean) => void; knownTotal?: boolean }) {
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<string>()
  const [error, setError] = useState('')
  const [calorieDrafts, setCalorieDrafts] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  useEffect(() => { onDirty?.(!!text || !!photo || Object.keys(calorieDrafts).length > 0) }, [text, photo, calorieDrafts, onDirty])
  const clearCalories = (id: string) => setCalorieDrafts(drafts => { const next = { ...drafts }; delete next[id]; return next })
  const saveCalories = async (meal: Meal, value: string) => {
    const kcal = Number(value)
    if (!value.trim() || !Number.isInteger(kcal) || kcal < 0 || kcal > 10000) { setError('Enter calories between 0 and 10,000. Your correction has not been saved.'); return }
    if (kcal === meal.kcal) { clearCalories(meal.id); return }
    setEditing(true); setError('')
    try { await onUpdate(meal.id, kcal); clearCalories(meal.id) } catch { setError('Could not save these calories. Your correction is still here.') } finally { setEditing(false) }
  }
  const total = meals.reduce((sum, meal) => sum + meal.kcal, 0)
  const shownTotal = useCountUp(total)
  const grams = (key: 'proteinG' | (typeof NUTRIENT_LABELS)[number][0]) => Math.round(meals.reduce((sum, meal) => sum + (meal[key] ?? 0), 0))
  const proteinTarget = bodyKg ? Math.round(DEFAULT_PROTEIN_PER_KG * bodyKg) : undefined
  // Meals that weren't in the last list flash for the length of the animation; the first list has nothing to compare against.
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => {
    const added = seen.current ? meals.filter(meal => !seen.current!.has(meal.id)).map(meal => meal.id) : []
    seen.current = new Set(meals.map(meal => meal.id))
    if (!added.length) return
    setFresh(new Set(added))
    const timer = setTimeout(() => setFresh(new Set()), 1400)
    return () => clearTimeout(timer)
  }, [meals])
  const add = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim() && !photo) return
    onAdd(text, photo); setText(''); setPhoto(undefined); setError('')
  }
  return <article className="finance-card weight-food">
    <span className="finance-eyebrow">{title}</span>
    <div className="weight-food__total">{knownTotal ? <><strong>{shownTotal}</strong> kcal{phase && <small> of {phase.intakeKcal} planned · {total <= phase.intakeKcal ? `${phase.intakeKcal - total} left` : <span className="weight-stat--bad">{total - phase.intakeKcal} over</span>}</small>}</> : <span>No food logged · total unknown</span>}</div>
    {knownTotal && phase && <progress className={total > phase.intakeKcal ? 'is-over' : undefined} value={Math.min(total, phase.intakeKcal)} max={phase.intakeKcal} aria-label="Eaten of planned intake" />}
    {meals.some(meal => meal.proteinG != null) && <dl className="weight-food__nutrients">
      <div className="weight-food__protein"><dt>Protein</dt><dd>{grams('proteinG')}<small>{proteinTarget ? ` / ${proteinTarget} g` : ' g'}</small></dd>
        {proteinTarget && <progress value={Math.min(grams('proteinG'), proteinTarget)} max={proteinTarget} aria-label="Protein of target" />}</div>
      {NUTRIENT_LABELS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{grams(key)}<small> g</small></dd></div>)}
    </dl>}
    {meals.some(meal => meal.proteinG == null) && meals.some(meal => meal.proteinG != null) && <p className="finance-muted">Nutrient totals exclude meals without nutrient estimates.</p>}
    {(meals.length > 0 || jobs.length > 0) && <ul className="weight-food__meals">{meals.map(meal => <li key={meal.id} className={fresh.has(meal.id) ? 'is-new' : undefined}>
      <time>{new Date(meal.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</time>
      <span>{meal.description}{meal.proteinG != null && <small className="weight-food__macros">{Math.round(meal.proteinG)}P · {Math.round(meal.carbsG ?? 0)}C · {Math.round(meal.fatG ?? 0)}F</small>}</span>
      <label><input type="number" min="0" max="10000" step="1" disabled={editing} value={calorieDrafts[meal.id] ?? String(meal.kcal)} aria-label={`kcal for ${meal.description}`}
        onChange={event => { setCalorieDrafts(drafts => ({ ...drafts, [meal.id]: event.target.value })); onDirty?.(true) }} onBlur={event => { if (calorieDrafts[meal.id] !== undefined && !editing) void saveCalories(meal, event.target.value) }} /> kcal</label>
      <button type="button" className="finance-remove" disabled={editing} aria-label={`Delete ${meal.description}`} onClick={() => { if (window.confirm('Delete this meal?')) { setEditing(true); void onDelete(meal.id).then(() => clearCalories(meal.id)).catch(() => setError('Could not delete this meal.')).finally(() => setEditing(false)) } }}>×</button>
    </li>)}
      {jobs.map(job => <li key={job.id} className={job.status === 'estimating' ? 'is-pending' : 'is-failed'} aria-live="polite">
        {job.image ? <span className={job.status === 'estimating' ? 'weight-food__scan' : 'weight-food__photo'}><img src={job.image} alt="Submitted meal" /></span> : <time>now</time>}
        <span className={job.status === 'estimating' ? 'weight-food__thinking' : 'weight-food__failure'}>{job.text || 'Meal photo'}{job.status === 'estimating' ? <i>Estimating</i> : <small>{job.message}</small>}</span>
        {job.status === 'estimating' ? <span className="weight-food__dots" aria-hidden="true"><i /><i /><i /></span> : <span className="weight-food__job-actions"><button type="button" aria-label={`${job.status === 'saved' ? 'Refresh' : 'Retry'} ${job.text || 'meal photo'}`} onClick={() => onRetry?.(job.id)}>{job.status === 'saved' ? 'Refresh' : 'Retry'}</button><button type="button" className="finance-remove" aria-label={`Dismiss ${job.text || 'meal photo'}`} onClick={() => onDismiss?.(job.id)}>×</button></span>}
      </li>)}
    </ul>}
    <form className="weight-food__add" onSubmit={add}>
      <label className="weight-food__camera" title="Add a photo">
        {photo ? <img src={photo} alt="Meal photo" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" /></svg>}
        <input type="file" accept="image/*" capture="environment" aria-label="Meal photo" onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (file) void shrinkPhoto(file).then(value => { setPhoto(value); onDirty?.(true) }, () => setError('Couldn’t read that photo.'))
        }} />
      </label>
      {photo && <button type="button" className="finance-remove" aria-label="Remove photo" onClick={() => { setPhoto(undefined); onDirty?.(!!text) }}>×</button>}
      <input value={text} onChange={e => { setText(e.target.value); onDirty?.(!!e.target.value || !!photo) }} placeholder={photo ? 'Anything to add? e.g. half portion' : 'What did you eat? e.g. 2 eggs, toast and a coffee with milk'} maxLength={500} required={!photo} />
      <button type="submit" className="finance-primary" disabled={!text.trim() && !photo}>Add</button>
    </form>
    {error && <p role="alert" className="finance-danger">{error}</p>}
  </article>
}
