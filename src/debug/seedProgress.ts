import { getDB, saveDailyTime } from '../services/db'
import { invalidateProgressSnapshot } from '../hooks/useProgressData'
import { emitProgress } from '../services/progressEvents'
import { resetDailyTimeCache } from '../services/dailyTime'
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
}

export async function seedProgress(options: SeedOptions = {}): Promise<string> {
  const { knownWords = 1221, days = 24, due = 15, minutesToday = 12 } = options

  const db = await getDB()
  await Promise.all([
    db.clear('wordProgress'),
    db.clear('packageProgress'),
    db.clear('sessions'),
    db.clear('dailyTime'),
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
      // Spread lastSeen back across the seeded window so time-based views have
      // something to show.
      const ago = Math.floor((remaining / Math.max(knownWords, 1)) * days)
      const seen = shiftDay(-Math.min(ago, days - 1), today)
      const isDue = words.length < due

      words.push({
        wordId: `${pack.id}-${seq}`,
        packageId: pack.id,
        seenCount: 1 + (words.length % 3),
        lastSeen: `${seen}T12:00:00.000Z`,
        status: 'known',
        reviewCount: words.length % 4,
        nextReviewAt: isDue ? shiftDay(-2, today) : shiftDay(7 + (words.length % 30), today),
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

  return `Zasiano: ${words.length} słów, ${sessions.length} sesji, ${due} do powtórki.`
}

export async function clearProgress(): Promise<string> {
  const db = await getDB()
  await Promise.all([
    db.clear('wordProgress'),
    db.clear('packageProgress'),
    db.clear('sessions'),
    db.clear('dailyTime'),
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
