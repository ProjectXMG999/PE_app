/**
 * One convention for "which day did this happen on", shared by every streak,
 * daily-goal, review-scheduling and activity calculation in the app.
 *
 * Why this module exists: `session.date` used to be written as
 * `new Date().toISOString().split('T')[0]` — a **UTC** day — while the activity
 * chart and the time-of-day bands read it back with **local** arithmetic. For
 * UTC+1/+2 (Poland) that made the day roll over at 01:00/02:00 local time, so a
 * late-evening session could land on tomorrow's streak. Everything now uses the
 * LOCAL day, because that is the day the user actually lived through.
 *
 * All keys are `YYYY-MM-DD` strings, which sort lexicographically in date order —
 * so `a < b`, `Math.min`, `.sort()` and range filters all work directly on them.
 */

/** Local-calendar day key for a moment in time. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Parses a day key back to a local Date anchored at **noon**. Noon rather than
 * midnight so that adding/subtracting days can't be knocked into the wrong day
 * by a daylight-saving transition (Poland shifts at 02:00/03:00).
 */
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Day key `offset` days away from `from` (negative = into the past). */
export function shiftDay(offset: number, from: Date | string = new Date()): string {
  const base = typeof from === 'string' ? parseDay(from) : new Date(from)
  base.setDate(base.getDate() + offset)
  return dayKey(base)
}

/** Whole days from `a` to `b`. Positive when `b` is the later day. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000)
}

/** Day key for today. */
export function today(): string {
  return dayKey()
}

/** True when `key` is a Saturday or Sunday. */
export function isWeekend(key: string): boolean {
  const wd = parseDay(key).getDay()
  return wd === 0 || wd === 6
}
