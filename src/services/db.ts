import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { Session, WordProgress, PackageProgress, DailyTime } from '../types/progress'
import { supabase } from './supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { emitProgress } from './progressEvents'
import { dayKey, shiftDay, daysBetween } from '../utils/day'

// Best-effort push to the user's Supabase account — silent no-op when signed
// out or Supabase isn't configured. Local IndexedDB stays the source of truth
// for the app itself; this just mirrors writes out for cross-device sync.
// sessions is append-only (no stable natural key to upsert on locally), so it
// inserts a new row each time; word/package progress upsert on their natural keys.
function syncInsert(table: 'sessions', row: Record<string, unknown>) {
  const userId = useAuthStore.getState().user?.id
  if (!supabase || !userId) return
  supabase.from(table).insert({ ...row, user_id: userId }).then(({ error }) => {
    if (error) console.error(`[progressSync] insert into ${table} failed:`, error.message)
  })
}

function syncUpsert(table: 'word_progress' | 'package_progress' | 'daily_time', row: Record<string, unknown>) {
  const userId = useAuthStore.getState().user?.id
  if (!supabase || !userId) return
  supabase.from(table).upsert({ ...row, user_id: userId }).then(({ error }) => {
    if (error) console.error(`[progressSync] upsert into ${table} failed:`, error.message)
  })
}

interface PEDB extends DBSchema {
  sessions: {
    key: number
    value: Session
    indexes: { 'by-date': string; 'by-package': string }
  }
  wordProgress: {
    key: string
    value: WordProgress
    indexes: { 'by-package': string }
  }
  packageProgress: {
    key: string
    value: PackageProgress
  }
  dailyTime: {
    key: string
    value: DailyTime
  }
}

let dbPromise: Promise<IDBPDatabase<PEDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PEDB>('PE_DB', 4, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true })
          sessions.createIndex('by-date', 'date')
          sessions.createIndex('by-package', 'packageId')

          const wordProgress = db.createObjectStore('wordProgress', { keyPath: 'wordId' })
          wordProgress.createIndex('by-package', 'packageId')

          db.createObjectStore('packageProgress', { keyPath: 'packageId' })
        }
        // v2: masteredAt field — no store changes needed, field is optional and added at write time
        // v3: startedAt/autoplayMode fields on sessions — no store changes needed, both optional
        // v4: durationSec/trainMode on sessions and the review fields on
        //     wordProgress are likewise optional, but the daily time ledger is
        //     a new store.
        if (oldVersion < 4) {
          db.createObjectStore('dailyTime', { keyPath: 'date' })
        }
      },
    })
  }
  return dbPromise
}

export async function saveSession(session: Omit<Session, 'id'>): Promise<void> {
  const db = await getDB()
  await db.add('sessions', session as Session)
  syncInsert('sessions', {
    package_id: session.packageId,
    date: session.date,
    started_at: session.startedAt,
    words_completed: session.wordsCompleted,
    mode: session.mode,
    autoplay_mode: session.autoplayMode,
    train_mode: session.trainMode,
    duration_sec: session.durationSec,
  })
  emitProgress('session')
}

export async function getSessions(days = 7): Promise<Session[]> {
  const db = await getDB()
  const all = await db.getAll('sessions')
  const cutoffStr = shiftDay(-days)
  return all.filter(s => s.date >= cutoffStr)
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB()
  return db.getAll('sessions')
}

export async function saveWordProgress(wp: WordProgress): Promise<void> {
  const db = await getDB()
  await db.put('wordProgress', wp)
  syncUpsert('word_progress', {
    word_id: wp.wordId,
    package_id: wp.packageId,
    seen_count: wp.seenCount,
    last_seen: wp.lastSeen,
    status: wp.status,
    review_count: wp.reviewCount,
    lapse_count: wp.lapseCount,
    last_lapse_at: wp.lastLapseAt,
    next_review_at: wp.nextReviewAt,
  })
  emitProgress('word')
}

/** Words whose scheduled review date has arrived (or passed). */
export async function getDueWordProgress(on: string = dayKey()): Promise<WordProgress[]> {
  const db = await getDB()
  const all = await db.getAll('wordProgress')
  return all.filter(w => w.nextReviewAt != null && w.nextReviewAt <= on)
}

export async function getWordProgress(wordId: string): Promise<WordProgress | undefined> {
  const db = await getDB()
  return db.get('wordProgress', wordId)
}

export async function getPackageWordProgress(packageId: string): Promise<WordProgress[]> {
  const db = await getDB()
  return db.getAllFromIndex('wordProgress', 'by-package', packageId)
}

export async function getAllWordProgress(): Promise<WordProgress[]> {
  const db = await getDB()
  return db.getAll('wordProgress')
}

export async function getTotalKnownWords(): Promise<number> {
  const db = await getDB()
  const all = await db.getAll('wordProgress')
  return all.filter(w => w.status === 'known').length
}

export async function savePackageProgress(pp: PackageProgress): Promise<void> {
  const db = await getDB()
  await db.put('packageProgress', pp)
  syncUpsert('package_progress', {
    package_id: pp.packageId,
    started_at: pp.startedAt,
    completed_at: pp.completedAt,
    mastered_at: pp.masteredAt,
    current_index: pp.currentIndex,
  })
  emitProgress('package')
}

export async function getPackageProgress(packageId: string): Promise<PackageProgress | undefined> {
  const db = await getDB()
  return db.get('packageProgress', packageId)
}

export async function getAllPackageProgress(): Promise<PackageProgress[]> {
  const db = await getDB()
  return db.getAll('packageProgress')
}

export async function resetAllProgress(): Promise<void> {
  const db = await getDB()
  await Promise.all([
    db.clear('wordProgress'),
    db.clear('packageProgress'),
    db.clear('sessions'),
    db.clear('dailyTime'),
  ])
  emitProgress('reset')
}

export async function resetProgressForPackages(packageIds: string[]): Promise<void> {
  const db = await getDB()
  const tx1 = db.transaction('packageProgress', 'readwrite')
  await Promise.all(packageIds.map(id => tx1.store.delete(id)))
  await tx1.done

  const allWords = await db.getAll('wordProgress')
  const toDelete = allWords.filter(w => packageIds.includes(w.packageId)).map(w => w.wordId)
  const tx2 = db.transaction('wordProgress', 'readwrite')
  await Promise.all(toDelete.map(id => tx2.store.delete(id)))
  await tx2.done

  const allSessions = await db.getAll('sessions')
  const sessionsToDelete = allSessions.filter(s => packageIds.includes(s.packageId) && s.id != null).map(s => s.id!)
  const tx3 = db.transaction('sessions', 'readwrite')
  await Promise.all(sessionsToDelete.map(id => tx3.store.delete(id)))
  await tx3.done

  emitProgress('reset')
}

/**
 * Current run of consecutive study days, counting back from today.
 *
 * `frozenDays` are days the user missed but spent a streak freeze on. They keep
 * the chain unbroken without being counted as study — a freeze protects the
 * streak, it doesn't fake a session.
 */
export async function getStreak(frozenDays: string[] = []): Promise<number> {
  const db = await getDB()
  const all = await db.getAll('sessions')
  if (all.length === 0) return 0

  const studied = new Set(all.map(s => s.date))
  const frozen = new Set(frozenDays)
  const covered = (d: string) => studied.has(d) || frozen.has(d)

  // The chain has to reach today or yesterday to still be alive; a freeze on
  // yesterday is exactly what keeps it alive after a missed day.
  const todayKey = dayKey()
  const yesterdayKey = shiftDay(-1)
  let cursor = covered(todayKey) ? todayKey : covered(yesterdayKey) ? yesterdayKey : null
  if (cursor === null) return 0

  let streak = 0
  while (covered(cursor)) {
    if (studied.has(cursor)) streak++
    cursor = shiftDay(-1, cursor)
  }
  return streak
}

/**
 * Longest run of consecutive study days across all of history, not just the
 * current run. Deliberately ignores freezes: a personal record should reflect
 * days actually studied.
 */
export async function getLongestStreak(): Promise<number> {
  const db = await getDB()
  const all = await db.getAll('sessions')
  if (all.length === 0) return 0

  const dates = [...new Set(all.map(s => s.date))].sort()

  let longest = 1
  let current = 1
  for (let i = 1; i < dates.length; i++) {
    current = daysBetween(dates[i - 1], dates[i]) === 1 ? current + 1 : 1
    longest = Math.max(longest, current)
  }
  return longest
}

/** Most words completed across all sessions saved on a single day. */
export async function getBestDayWordCount(): Promise<number> {
  const db = await getDB()
  const all = await db.getAll('sessions')
  if (all.length === 0) return 0

  const byDate = new Map<string, number>()
  for (const s of all) {
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.wordsCompleted)
  }
  return Math.max(...byDate.values())
}

export type TimeOfDayBand = 'rano' | 'popołudnie' | 'wieczór' | 'noc'

export interface TimeOfDayStats {
  band: TimeOfDayBand
  sessionCount: number
  avgWordsPerSession: number
  /** 0-100, normalized against the best-performing band. */
  effectivenessPct: number
}

function bandForHour(hour: number): TimeOfDayBand {
  if (hour >= 5 && hour < 12) return 'rano'
  if (hour >= 12 && hour < 18) return 'popołudnie'
  if (hour >= 18 && hour < 24) return 'wieczór'
  return 'noc'
}

/**
 * Average words-per-session by time of day, only over sessions that have a
 * startedAt timestamp (older sessions predate this field and are skipped).
 * Returns null if there isn't enough timestamped history yet (min 5 sessions).
 */
export async function getEffectivenessByTimeOfDay(): Promise<TimeOfDayStats[] | null> {
  const db = await getDB()
  const all = await db.getAll('sessions')
  const timestamped = all.filter(s => s.startedAt)
  if (timestamped.length < 5) return null

  const byBand = new Map<TimeOfDayBand, { words: number; sessions: number }>()
  for (const s of timestamped) {
    const hour = new Date(s.startedAt!).getHours()
    const band = bandForHour(hour)
    const entry = byBand.get(band) ?? { words: 0, sessions: 0 }
    entry.words += s.wordsCompleted
    entry.sessions += 1
    byBand.set(band, entry)
  }

  const avgByBand = [...byBand.entries()].map(([band, { words, sessions }]) => ({
    band,
    sessionCount: sessions,
    avgWordsPerSession: words / sessions,
  }))
  const best = Math.max(...avgByBand.map(b => b.avgWordsPerSession), 1)

  return avgByBand
    .map(b => ({ ...b, effectivenessPct: Math.round((b.avgWordsPerSession / best) * 100) }))
    .sort((a, b) => b.effectivenessPct - a.effectivenessPct)
}

// ── Daily time ledger ────────────────────────────────────────────────────────
// Sessions are only written when a pack is finished, so an abandoned session
// would otherwise leave no record of the time spent. This store is ticked every
// 30 s while studying, which is what the daily goal and its toasts read from.

export async function getDailyTime(date: string = dayKey()): Promise<DailyTime | undefined> {
  const db = await getDB()
  return db.get('dailyTime', date)
}

export async function getAllDailyTime(): Promise<DailyTime[]> {
  const db = await getDB()
  return db.getAll('dailyTime')
}

export async function saveDailyTime(dt: DailyTime): Promise<void> {
  const db = await getDB()
  await db.put('dailyTime', dt)
  syncUpsert('daily_time', {
    date: dt.date,
    seconds_studied: dt.secondsStudied,
    goal_sec: dt.goalSec,
    goal_met_at: dt.goalMetAt,
  })
  emitProgress('dailyTime')
}

/** Days on which the user reached their goal — the metric behind the 🎯 badges. */
export async function getGoalMetDays(): Promise<string[]> {
  const all = await getAllDailyTime()
  return all.filter(d => d.goalMetAt != null).map(d => d.date).sort()
}
