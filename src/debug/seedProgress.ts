import { getDB, saveDailyTime } from '../services/db'
import { invalidateProgressSnapshot } from '../hooks/useProgressData'
import { emitProgress } from '../services/progressEvents'
import { resetDailyTimeCache } from '../services/dailyTime'
import { seedFromLadder } from '../services/fsrs'
import { REVIEW_LADDER } from '../services/reviewConfig'
import { useAppStore } from '../store/useAppStore'
import { Session, WordProgress } from '../types/progress'
import { dayKey, shiftDay } from '../utils/day'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'

/**
 * Development-only progress seeding.
 *
 * The Postęp and Dziś screens look completely different at 0, 300, 1 221 and
 * 10 000 words, and reaching those states by hand is hours of tapping. Exposed
 * on `window.__seed` so the states can be checked in a real browser rather than
 * reasoned about.
 *
 * Writes straight to IndexedDB and deliberately does NOT mirror to Supabase —
 * fake history has no business syncing to a real account.
 */

const allPacks = packagesIndex as PackMeta[]

export interface SeedOptions {
  /** Words to mark known, filled from the start of the route in order. */
  knownWords?: number
  /** Consecutive days of history to generate, ending today. */
  days?: number
  /** Leave this many known words overdue for review. */
  due?: number
  /** Minutes studied today, for the daily goal ring. */
  minutesToday?: number
  /** Shortcut for a big backlog: overrides `due` with 150. */
  heavyBacklog?: boolean
  /** First N due words → reviewCount 4 (one "Znam" from graduating). */
  nearGraduation?: number
  /** First N due words → lapseCount 3 ("leech" — turns urgency red). */
  leeches?: number
  /** First N words → already graduated (reviewCount 5, retiredAt set, unscheduled). */
  retired?: number
  /** First N due words → 30 days overdue (pair with todayLevel ≥ 2 in the UI). */
  belowLevelDue?: number
  /** First N due words → FSRS state with low retrievability (S≈3, seen 22d ago → R≈0.6). */
  aboutToForget?: number
  /** First N words → FSRS-durable (stability 400 → deep maintenance / retired). */
  durable?: number
}

export async function seedProgress(options: SeedOptions = {}): Promise<string> {
  const {
    knownWords = 1221, days = 24, minutesToday = 12,
    heavyBacklog = false, nearGraduation = 0, leeches = 0, retired = 0, belowLevelDue = 0,
    aboutToForget = 0, durable = 0,
  } = options
  const due = options.due ?? (heavyBacklog ? 150 : 15)

  const db = await getDB()
  await Promise.all([
    db.clear('wordProgress'),
    db.clear('packageProgress'),
    db.clear('sessions'),
    db.clear('dailyTime'),
    db.clear('reviewLedger'),
  ])

  const today = dayKey()
  const words: WordProgress[] = []
  const sessions: Omit<Session, 'id'>[] = []

  let remaining = knownWords
  let packIdx = 0

  while (remaining > 0 && packIdx < allPacks.length) {
    const pack = allPacks[packIdx]
    const take = Math.min(remaining, pack.wordCount)

    for (let i = 0; i < take; i++) {
      const seq = String(i + 1).padStart(3, '0')
      // Spread lastSeen back across the seeded window — but never onto today, so
      // reviewsDoneToday() (which keys on lastSeen === today) isn't fooled into
      // thinking the whole backlog was already reviewed.
      const ago = 2 + Math.floor((remaining / Math.max(knownWords, 1)) * (days - 2))
      const seen = shiftDay(-Math.min(Math.max(2, ago), days - 1), today)
      const isDue = words.length < due

      const reviewCount = words.length % 4
      const fsrs = seedFromLadder(REVIEW_LADDER, reviewCount, 0)
      words.push({
        wordId: `${pack.id}-${seq}`,
        packageId: pack.id,
        seenCount: 1 + (words.length % 3),
        lastSeen: `${seen}T12:00:00.000Z`,
        status: 'known',
        reviewCount,
        nextReviewAt: isDue ? shiftDay(-2, today) : shiftDay(7 + (words.length % 30), today),
        stability: fsrs.stability,
        difficulty: fsrs.difficulty,
      })
    }

    const mastered = take === pack.wordCount
    await db.put('packageProgress', {
      packageId: pack.id,
      startedAt: `${shiftDay(-days, today)}T12:00:00.000Z`,
      completedAt: `${today}T12:00:00.000Z`,
      masteredAt: mastered ? `${today}T12:00:00.000Z` : null,
      currentIndex: take,
    })

    remaining -= take
    packIdx++
  }

  // Scenario overlays — mutate the first slice of words to exercise graduation,
  // the priority weights, the urgency indicator and the retirement round-trip.
  for (let i = 0; i < retired && i < words.length; i++) {
    words[i].reviewCount = 5
    words[i].retiredAt = shiftDay(-1, today) + 'T12:00:00.000Z'
    words[i].nextReviewAt = undefined
  }
  for (let i = retired; i < retired + nearGraduation && i < words.length; i++) {
    words[i].reviewCount = 4
    words[i].nextReviewAt = shiftDay(-1, today)
  }
  for (let i = 0; i < leeches && i < words.length; i++) {
    if (words[i].retiredAt != null) continue
    words[i].lapseCount = 3
    words[i].reviewCount = Math.min(words[i].reviewCount ?? 0, 2)
    words[i].difficulty = 9
    words[i].nextReviewAt = shiftDay(-3, today)
  }
  for (let i = 0; i < belowLevelDue && i < words.length; i++) {
    if (words[i].retiredAt != null) continue
    words[i].nextReviewAt = shiftDay(-30, today)
  }
  // FSRS scenarios (need FSRS_ENABLED to affect the schedule, but visible in the
  // priority/urgency maths via retrievability regardless).
  for (let i = 0; i < aboutToForget && i < words.length; i++) {
    if (words[i].retiredAt != null) continue
    words[i].stability = 3
    words[i].difficulty = 6
    words[i].lastSeen = `${shiftDay(-22, today)}T12:00:00.000Z`  // R ≈ 0.6
    words[i].nextReviewAt = shiftDay(-3, today)
  }
  for (let i = 0; i < durable && i < words.length; i++) {
    words[i].stability = 400
    words[i].difficulty = 4
    words[i].retiredAt = `${shiftDay(-30, today)}T12:00:00.000Z`
    words[i].nextReviewAt = shiftDay(300, today)  // deep maintenance
  }

  for (const w of words) await db.put('wordProgress', w)

  // Session history: most days active, a couple skipped so the heatmap and the
  // streak logic have something realistic to chew on.
  const modes: Session['autoplayMode'][] = ['fast', 'standard', 'speaking']
  for (let i = days - 1; i >= 0; i--) {
    if (i % 7 === 3) continue // a missed day each week
    const date = shiftDay(-i, today)
    const pack = allPacks[(days - i) % allPacks.length]
    const words = 8 + ((days - i) * 7) % 40
    sessions.push({
      packageId: pack.id,
      date,
      startedAt: `${date}T${String(7 + ((days - i) % 15)).padStart(2, '0')}:30:00.000Z`,
      wordsCompleted: words,
      mode: i % 3 === 0 ? 'fiszki' : 'autoplay',
      autoplayMode: i % 3 === 0 ? undefined : modes[i % 3],
      trainMode: i % 3 === 0 ? 'word-flash' : undefined,
      durationSec: words * 9,
    })
  }
  for (const s of sessions) await db.add('sessions', s as Session)

  // Daily time, including a few days that met the goal.
  const goalSec = useAppStore.getState().dailyGoalSec
  for (let i = days - 1; i >= 0; i--) {
    if (i % 7 === 3) continue
    const date = shiftDay(-i, today)
    const secs = i === 0 ? minutesToday * 60 : (10 + (i * 13) % 40) * 60
    await saveDailyTime({
      date,
      secondsStudied: secs,
      goalSec,
      goalMetAt: secs >= goalSec ? `${date}T20:00:00.000Z` : null,
    })
  }

  resetDailyTimeCache()
  invalidateProgressSnapshot()
  emitProgress('reset')

  const extras = [
    retired && `${retired} retired`,
    nearGraduation && `${nearGraduation} nearGrad`,
    leeches && `${leeches} leech`,
    belowLevelDue && `${belowLevelDue} belowLvl`,
    aboutToForget && `${aboutToForget} aboutToForget`,
    durable && `${durable} durable`,
  ].filter(Boolean).join(', ')
  return `Zasiano: ${words.length} słów, ${sessions.length} sesji, ${due} do powtórki${extras ? ` (${extras})` : ''}.`
}

export async function clearProgress(): Promise<string> {
  const db = await getDB()
  await Promise.all([
    db.clear('wordProgress'),
    db.clear('packageProgress'),
    db.clear('sessions'),
    db.clear('dailyTime'),
    db.clear('reviewLedger'),
  ])
  useAppStore.setState({ achievementUnlocks: {} })
  resetDailyTimeCache()
  invalidateProgressSnapshot()
  emitProgress('reset')
  return 'Wyczyszczono cały lokalny postęp.'
}

declare global {
  interface Window {
    __seed?: typeof seedProgress
    __clearProgress?: typeof clearProgress
  }
}

if (import.meta.env.DEV) {
  window.__seed = seedProgress
  window.__clearProgress = clearProgress
}
