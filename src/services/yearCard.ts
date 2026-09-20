import { ProgressSnapshot } from '../hooks/useProgressData'
import { DailyTime } from '../types/progress'
import { ROUTE_TOTAL } from '../data/levels'
import { measuredStudyMinutes } from '../hooks/useStats'
import { studyDayKeys } from '../utils/studyDays'
import { plDays, plSessions, plWords } from '../utils/plural'
import { renderShareCard, shareImage, type ShareCardSpec, type ShareResult } from './shareCard'

/**
 * The year, as one card.
 *
 * The only thing in the app that leaves it. Everything else here improves the
 * experience of someone already using it; this is the one artefact a learner
 * hands to someone who isn't.
 *
 * Deliberately one card rather than a run of story slides: the figures below
 * are the ones that mean something to a person who doesn't use the app, and a
 * single image is what actually gets sent.
 */

export interface YearSummary {
  year: number
  wordsPractised: number
  minutes: number
  sessions: number
  activeDays: number
  goalDays: number
  bestDay: { date: string; count: number } | null
  knownTotal: number
  toNextStation: number | null
  nextStationName: string | null
}

/**
 * How much history makes a year card worth offering.
 *
 * Far stricter than the weekly recap's `activeDays > 0`. A "year in review"
 * built from four days of use is embarrassing for the person who shares it,
 * which is the opposite of the point — so the card simply isn't offered until
 * there is a year's worth of *something* to show.
 */
export const YEAR_CARD_MIN_DAYS = 20
export const YEAR_CARD_MIN_WORDS = 150

export function yearWorthShowing(y: YearSummary): boolean {
  return y.activeDays >= YEAR_CARD_MIN_DAYS && y.wordsPractised >= YEAR_CARD_MIN_WORDS
}

export function computeYearSummary(
  snapshot: ProgressSnapshot,
  dailyTime: DailyTime[],
  next: { words: number; name: string } | null,
  year = new Date().getFullYear()
): YearSummary {
  // Day keys sort lexicographically (utils/day.ts), so a string prefix is a
  // correct and allocation-free way to select the year.
  const prefix = `${year}-`
  const sessions = snapshot.sessions.filter(s => s.date.startsWith(prefix))
  const daily = dailyTime.filter(d => d.date.startsWith(prefix))

  const byDate = new Map<string, number>()
  for (const s of sessions) byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.wordsCompleted)

  let bestDay: YearSummary['bestDay'] = null
  for (const [date, count] of byDate) {
    if (bestDay == null || count > bestDay.count) bestDay = { date, count }
  }

  return {
    year,
    wordsPractised: sessions.reduce((sum, s) => sum + s.wordsCompleted, 0),
    // The ledger, not the sessions — same measure as "Czas nauki" on Postęp.
    minutes: measuredStudyMinutes(daily, sessions),
    sessions: sessions.length,
    activeDays: studyDayKeys(sessions, daily).size,
    goalDays: daily.filter(d => d.goalMetAt != null).length,
    bestDay,
    // Not filtered by year: the route total is cumulative by definition, and a
    // card that showed only this year's share of it would understate the user.
    knownTotal: snapshot.knownTotal,
    toNextStation: next?.words ?? null,
    nextStationName: next?.name ?? null,
  }
}

export function yearCardSpec(y: YearSummary): ShareCardSpec {
  const hours = Math.round(y.minutes / 60)
  return {
    kicker: `MÓJ ${y.year} Z ANGIELSKIM`,
    headline: y.wordsPractised.toLocaleString('pl-PL'),
    subline: `${plWords(y.wordsPractised)} przerobionych w ${y.year}`,
    stats: [
      { value: `${hours}`, label: hours === 1 ? 'godzina nauki' : 'godzin nauki' },
      { value: `${y.activeDays}`, label: `${plDays(y.activeDays)} z treningiem` },
      { value: `${y.sessions}`, label: plSessions(y.sessions) },
      { value: `${y.bestDay?.count ?? 0}`, label: 'słów w jeden dzień' },
    ],
    route: {
      knownTotal: y.knownTotal,
      total: ROUTE_TOTAL,
      toNext: y.toNextStation,
      nextName: y.nextStationName,
    },
  }
}

export async function shareYear(y: YearSummary): Promise<ShareResult> {
  const blob = await renderShareCard(yearCardSpec(y))
  return shareImage(blob, `progress-${y.year}.png`, `Mój ${y.year} z angielskim — Progress`)
}
