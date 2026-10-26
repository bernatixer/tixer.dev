const longDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const compactDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export const formatWeightDate = (date: string): string => longDate.format(new Date(`${date}T00:00:00Z`))
export const compactWeightDate = (date: string): string => compactDate.format(new Date(`${date}T00:00:00Z`))

export function parseWorkoutSpeed(sport: 'running' | 'jogging', value: string): number | null {
  let speedKmh = Number(value)
  if (sport === 'running') {
    const parts = /^(\d{1,2})(?::([0-5]\d))?$/.exec(value.trim())
    if (!parts) return null
    speedKmh = 3600 / (Number(parts[1]) * 60 + Number(parts[2] ?? 0))
  }
  return speedKmh >= 4 && speedKmh <= 23 ? speedKmh : null
}

export function formatRunningPace(speedKmh: number): string {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return ''
  const seconds = Math.round(3600 / speedKmh)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
