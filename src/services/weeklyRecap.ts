import { ProgressSnapshot } from '../hooks/useProgressData'
import { DailyTime } from '../types/progress'
import { AchievementState } from './achievements'
import { measuredStudyMinutes } from '../hooks/useStats'
import { dayKey, shiftDay } from '../utils/day'
import { studyDayKeys } from '../utils/studyDays'
import { plWords, plMinutes, plDays, plSessions, plPractised } from '../utils/plural'
import { ROUTE_TOTAL } from '../data/levels'
import { renderShareCard, shareImage, type ShareCardSpec, type ShareResult } from './shareCard'

/**
 * The week in review.
 *
 * Every figure here is counted from session and daily-time records rather than
 * inferred. In particular "words practised" is not "words learned": mastery is
 * timestamped by `lastSeen`, which a review moves forward, so counting mastered
 * words per week would quietly credit old words to whichever week they were
 * last revisited.
 */

export interface WeeklyRecap {
  /** Day keys, oldest first. */
  from: string
  to: string
  wordsPractised: number
  minutes: number
  sessions: number
  activeDays: number
  goalDays: number
  bestDay: { date: string; count: number } | null
  newBadges: AchievementState[]
  /** Words still to go before the next milestone. */
  toNextStation: number | null
  nextStationName: string | null
  knownTotal: number
}

export function computeWeeklyRecap(
  snapshot: ProgressSnapshot,
  dailyTime: DailyTime[],
  badges: AchievementState[],
  next: { words: number; name: string } | null,
  today = dayKey()
): WeeklyRecap {
  const from = shiftDay(-6, today)

  const week = snapshot.sessions.filter(s => s.date >= from && s.date <= today)
  const weekDaily = dailyTime.filter(d => d.date >= from && d.date <= today)

  const byDate = new Map<string, number>()
  for (const s of week) byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.wordsCompleted)

  let bestDay: WeeklyRecap['bestDay'] = null
  for (const [date, count] of byDate) {
    if (bestDay == null || count > bestDay.count) bestDay = { date, count }
  }

  const weekStart = `${from}T00:00:00.000Z`
  const newBadges = badges.filter(b => b.unlocked && b.unlockedAt != null && b.unlockedAt >= weekStart)

  return {
    from,
    to: today,
    wordsPractised: week.reduce((sum, s) => sum + s.wordsCompleted, 0),
    // The ledger, not the sessions: studiedMinutes(week) only sees packs the
    // user finished, so a week of real study with nothing closed reported
    // "3 minuty" on a page whose total said 672. Same measure as "Czas nauki".
    minutes: measuredStudyMinutes(weekDaily, week),
    sessions: week.length,
    // Same definition of a study day as the streak and the rhythm heatmap.
    activeDays: studyDayKeys(week, weekDaily).size,
    goalDays: weekDaily.filter(d => d.goalMetAt != null).length,
    bestDay,
    newBadges,
    toNextStation: next?.words ?? null,
    nextStationName: next?.name ?? null,
    knownTotal: snapshot.knownTotal,
  }
}

/** True once the week has anything worth reporting. Keyed on days studied, not
 *  on finished sessions — a week of real study with nothing closed is still a
 *  week worth showing. */
export function recapWorthShowing(r: WeeklyRecap): boolean {
  return r.activeDays > 0
}

// ── Share image ─────────────────────────────────────────────────────────────

/**
 * The week, as a share card.
 *
 * The drawing itself lives in services/shareCard.ts — this is only the mapping
 * from a WeeklyRecap to that template's fields. It used to be ~110 lines of
 * canvas code with the palette and the 10 000-word denominator hard-coded,
 * which is exactly what stopped the milestone card from reusing it.
 */
export function recapCardSpec(r: WeeklyRecap): ShareCardSpec {
  return {
    kicker: 'MÓJ TYDZIEŃ',
    headline: String(r.wordsPractised),
    subline: `${plWords(r.wordsPractised)} ${plPractised(r.wordsPractised)}`,
    stats: [
      { value: `${r.minutes}`, label: `${plMinutes(r.minutes)} nauki` },
      { value: `${r.activeDays}/7`, label: 'dni z treningiem' },
      { value: `${r.sessions}`, label: plSessions(r.sessions) },
      { value: `${r.goalDays}`, label: `${plDays(r.goalDays)} z celem` },
    ],
    route: {
      knownTotal: r.knownTotal,
      total: ROUTE_TOTAL,
      toNext: r.toNextStation,
      nextName: r.nextStationName,
    },
  }
}

export function renderRecapImage(r: WeeklyRecap): Promise<Blob | null> {
  return renderShareCard(recapCardSpec(r))
}

export async function shareRecap(r: WeeklyRecap): Promise<ShareResult> {
  const blob = await renderRecapImage(r)
  return shareImage(blob, `progress-${r.to}.png`, 'Mój tydzień w Progress')
}
