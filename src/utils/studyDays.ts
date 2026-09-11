import { DailyTime, Session } from '../types/progress'

/**
 * What counts as "a day you studied".
 *
 * The app keeps two independent records of study, and until this module existed
 * every widget picked one of them on its own:
 *
 *   • `sessions` — written only when a pack is FINISHED.
 *   • `dailyTime` — a live ledger, ticked every 30 s regardless of whether
 *     anything gets finished.
 *
 * The streak, the rhythm heatmap and "dni z treningiem" read sessions; the
 * daily goal, "Czas nauki" and the ⏱ badges read the ledger. So a user who
 * studies twenty minutes every evening without ever completing a pack earns
 * "cel dnia" twenty times while the heatmap shows an empty month and the streak
 * sits at zero — which is exactly the contradiction this fixes.
 *
 * One definition, used by all of them: a day counts if a session landed on it,
 * or if the ledger recorded at least a minute of study.
 */

/** Below this, a day is someone opening the app and closing it again. */
export const MIN_STUDY_SEC = 60

/** Every local day key that counts as studied. */
export function studyDayKeys(sessions: Session[], dailyTime: DailyTime[]): Set<string> {
  const days = new Set<string>()
  for (const s of sessions) days.add(s.date)
  for (const d of dailyTime) {
    if (d.secondsStudied >= MIN_STUDY_SEC) days.add(d.date)
  }
  return days
}

/**
 * Seconds of study per day, merging both records.
 *
 * The ledger is authoritative where it exists. Days from before it shipped
 * (DB < v4) have no row, so their sessions' own durations stand in — the same
 * fallback `measuredStudyMinutes()` uses, kept identical so the heatmap and the
 * "Czas nauki" total can never disagree about a given day.
 */
export function studySecondsByDay(sessions: Session[], dailyTime: DailyTime[]): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const d of dailyTime) byDay.set(d.date, d.secondsStudied)
  for (const s of sessions) {
    if (byDay.has(s.date)) continue
    const sec = s.durationSec ?? s.wordsCompleted * ESTIMATED_SECONDS_PER_WORD
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + sec)
  }
  return byDay
}

/** Fallback for sessions written before durationSec existed. Kept in step with
 *  the constant of the same name in hooks/useStats. */
const ESTIMATED_SECONDS_PER_WORD = 8

/**
 * Longest run of consecutive studied days, counting back from `from` (today by
 * default). `frozen` days bridge a gap without themselves adding to the count —
 * that's what a streak freeze buys.
 */
export function streakFrom(
  studied: Set<string>,
  frozen: Set<string>,
  from: string,
  prevDay: (d: string) => string
): number {
  const covered = (d: string) => studied.has(d) || frozen.has(d)
  const yesterday = prevDay(from)
  // The chain has to reach today or yesterday to still be alive; a freeze on
  // yesterday is exactly what keeps it alive after a missed day.
  let cursor = covered(from) ? from : covered(yesterday) ? yesterday : null
  if (cursor === null) return 0

  let streak = 0
  while (covered(cursor)) {
    if (studied.has(cursor)) streak++
    cursor = prevDay(cursor)
  }
  return streak
}
