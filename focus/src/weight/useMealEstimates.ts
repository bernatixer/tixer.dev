import { useRef, useState } from 'react'
import { ApiError, post } from '@/api/client'

export type MealEstimateJob = { id: string; date: string; text: string; image?: string; status: 'estimating' | 'failed' | 'saved'; message?: string }

export function useMealEstimates(onChange: () => Promise<unknown>) {
  // boffin: submitted meals belong to the page so closing a drawer cannot discard them.
  const pending = useRef(new Map<string, MealEstimateJob>())
  const inFlight = useRef(new Set<string>())
  const [jobs, setJobs] = useState<MealEstimateJob[]>([])
  const publish = () => setJobs([...pending.current.values()])
  const run = async (job: MealEstimateJob) => {
    if (inFlight.current.has(job.id)) return
    inFlight.current.add(job.id)
    try {
      if (job.status !== 'saved') {
        pending.current.set(job.id, { ...job, status: 'estimating', message: undefined }); publish()
        try { await post('/meals', { date: job.date, text: job.text, image: job.image, language: navigator.language }) }
        catch (cause) {
          pending.current.set(job.id, { ...job, status: 'failed', message: cause instanceof ApiError && cause.status === 422 ? 'That doesn’t look like food.' : cause instanceof ApiError && cause.status === 429 ? 'You’ve used today’s meal estimates. More tomorrow.' : 'Couldn’t estimate that right now. Try again in a minute.' }); publish()
          return
        }
      }
      // boffin: once the POST succeeds, retry may only refresh the saved meal.
      pending.current.set(job.id, { ...job, status: 'saved', message: 'Saved. Refreshing…' }); publish()
      try { await onChange(); pending.current.delete(job.id) }
      catch { pending.current.set(job.id, { ...job, status: 'saved', message: 'Saved, but this view could not refresh.' }) }
      publish()
    } finally { inFlight.current.delete(job.id) }
  }
  const add = (date: string, text: string, image?: string) => {
    const job: MealEstimateJob = { id: crypto.randomUUID(), date, text, image, status: 'estimating' }
    pending.current.set(job.id, job)
    void run(job)
  }
  const retry = (id: string) => { const job = pending.current.get(id); if (job && job.status !== 'estimating') void run(job) }
  const dismiss = (id: string) => { if (!inFlight.current.has(id)) { pending.current.delete(id); publish() } }
  return { jobs, add, retry, dismiss }
}
