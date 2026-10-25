export const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export const validTimeZone = (value: unknown): value is string => {
  if (typeof value !== "string" || !value) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
};

export function localNow(timeZone: string, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

// Food days roll over at 02:00, so a late snack belongs to the previous evening.
export const MEAL_DAY_ROLLOVER_HOURS = 2;
export const mealDate = (timeZone: string, now = new Date()) => localNow(timeZone, new Date(now.getTime() - MEAL_DAY_ROLLOVER_HOURS * 3600e3)).date;
