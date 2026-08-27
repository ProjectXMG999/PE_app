import { DailyTime } from '../types/progress'
import { getDailyTime, saveDailyTime } from './db'
import { useAppStore } from '../store/useAppStore'
import { dayKey } from '../utils/day'

/**
 * The daily study-time ledger.
 *
 * Sessions are only written when a pack is finished, so a session the user
 * abandons halfway leaves no record of the time they actually put in. This
 * module ticks a per-day counter while studying, which is what the daily goal,
 * its milestone toasts and the ⏱ badges read from.
 *
 * The ticker fires every second, so the running total is held in memory and
 * only persisted every 30 s (and on every milestone, and whenever the caller
 * flushes on pause/exit/page-hide). Losing up to half a minute to a hard crash
 * is a fair trade for not hitting IndexedDB — and Supabase — once a second.
 */

const FLUSH_INTERVAL_MS = 30_000

/** Fractions of the goal that fire a toast, in ascending order. */
export const MILESTONES = [0.5, 1, 2] as const
export type Milestone = (typeof MILESTONES)[number]

interface DayState {
  date: string
  /** Seconds already written to the store. */
  persisted: number
  /** Seconds counted since the last write. */
  pending: number
  /** The goal this day is judged against; frozen once the day is over. */
  goalSec: number
  goalMetAt: string | null
  /** Milestones already announced, so each toast fires once per day. */
  announced: Set<Milestone>
}

let state: DayState | null = null
let lastFlush = 0

function currentGoal(): number {
  return useAppStore.getState().dailyGoalSec
}

/** Loads (or rolls over to) the state for `date`. */
async function ensure(date: string): Promise<DayState> {
  if (state != null && state.date === date) return state
  // Crossing midnight mid-session: the seconds counted so far belong to
  // yesterday, so write them there before starting the new day.
  if (state != null) await flush()

  const stored = await getDailyTime(date)
  state = {
    date,
    persisted: stored?.secondsStudied ?? 0,
    pending: 0,
    goalSec: stored?.goalSec ?? currentGoal(),
    goalMetAt: stored?.goalMetAt ?? null,
    // A milestone already reached earlier today shouldn't re-announce when the
    // user opens a second session.
    announced: new Set(
      MILESTONES.filter(m => (stored?.secondsStudied ?? 0) >= (stored?.goalSec ?? currentGoal()) * m)
    ),
  }
  return state
}

/**
 * Records `seconds` of study. Returns the milestone crossed by this call so the
 * caller can show a toast — `null` on almost every tick.
 *
 * Safe to call once a second; it batches internally.
 */
export async function addStudyTime(seconds: number, now: Date = new Date()): Promise<Milestone | null> {
  if (seconds <= 0) return null

  const st = await ensure(dayKey(now))
  const goalSec = currentGoal()

  const before = st.persisted + st.pending
  st.pending += seconds
  const after = st.persisted + st.pending

  const crossed = milestoneCrossed(st, before, after, goalSec)

  if (crossed != null || Date.now() - lastFlush >= FLUSH_INTERVAL_MS) {
    await flush(now)
  }
  return crossed
}

function milestoneCrossed(st: DayState, before: number, after: number, goalSec: number): Milestone | null {
  if (goalSec <= 0) return null
  // Highest first, so a single long tick that jumps two thresholds reports the
  // more impressive one.
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    const m = MILESTONES[i]
    const threshold = goalSec * m
    if (before < threshold && after >= threshold && !st.announced.has(m)) {
      st.announced.add(m)
      return m
    }
  }
  return null
}

/** Persists whatever has been counted. Call on session end, pause and page hide. */
export async function flush(now: Date = new Date()): Promise<void> {
  if (state == null || state.pending <= 0) return

  const st = state
  const secondsStudied = st.persisted + st.pending
  // Today follows the current setting, so changing the goal takes effect at
  // once; a past day keeps the goal it was actually judged against.
  const goalSec = st.date === dayKey(now) ? currentGoal() : st.goalSec
  // Once reached, the stamp stands — raising the goal later can't retract a day
  // the user already earned.
  const goalMetAt = st.goalMetAt ?? (secondsStudied >= goalSec ? now.toISOString() : null)

  st.persisted = secondsStudied
  st.pending = 0
  st.goalSec = goalSec
  st.goalMetAt = goalMetAt
  lastFlush = Date.now()

  const next: DailyTime = { date: st.date, secondsStudied, goalSec, goalMetAt }
  await saveDailyTime(next)
}

export interface TodayProgress {
  secondsStudied: number
  goalSec: number
  /** 0-100, capped. */
  pct: number
  goalMet: boolean
}

/** Today's totals, including seconds not yet written to the store. */
export async function todayProgress(now: Date = new Date()): Promise<TodayProgress> {
  const date = dayKey(now)
  const goalSec = currentGoal()

  let secondsStudied: number
  if (state != null && state.date === date) {
    secondsStudied = state.persisted + state.pending
  } else {
    secondsStudied = (await getDailyTime(date))?.secondsStudied ?? 0
  }

  return {
    secondsStudied,
    goalSec,
    pct: goalSec > 0 ? Math.min(100, Math.round((secondsStudied / goalSec) * 100)) : 0,
    goalMet: goalSec > 0 && secondsStudied >= goalSec,
  }
}

/** Drops the in-memory day state. Used after a progress reset or account merge. */
export function resetDailyTimeCache(): void {
  state = null
  lastFlush = 0
}

/**
 * Wording for each milestone. Encouragement, never instruction — the user is
 * mid-session and doesn't need to be told what to do next.
 */
export function milestoneMessage(
  m: Milestone,
  secondsStudied: number,
  goalSec: number
): { text: string; icon: string; celebrate: boolean } {
  const mins = Math.round(secondsStudied / 60)
  const goalMins = Math.round(goalSec / 60)

  if (m === 1) {
    return {
      text: `Cel dnia osiągnięty — ${goalMins} minut. Tak trzymaj.`,
      icon: '🎯',
      celebrate: true,
    }
  }
  if (m === 2) {
    return {
      text: `Podwójna dawka — ${mins} minut dzisiaj.`,
      icon: '🔥',
      celebrate: true,
    }
  }
  return {
    text: `Dziś już ${mins} ${mins === 1 ? 'minuta' : 'minut'}. Jesteś w połowie celu.`,
    icon: '⏱',
    celebrate: false,
  }
}
