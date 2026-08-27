import { supabase } from './supabaseClient'
import { getAllSessions, getAllWordProgress, getAllPackageProgress, getAllDailyTime, getDB } from './db'
import { Session, WordProgress, PackageProgress, WordStatus, DailyTime } from '../types/progress'
import { emitProgress } from './progressEvents'

const STATUS_RANK: Record<WordStatus, number> = { new: 0, learning: 1, known: 2 }

function betterWordProgress(a: WordProgress, b: WordProgress): WordProgress {
  const winner =
    STATUS_RANK[a.status] !== STATUS_RANK[b.status]
      ? STATUS_RANK[a.status] > STATUS_RANK[b.status] ? a : b
      : a.lastSeen >= b.lastSeen ? a : b
  const other = winner === a ? b : a

  // Review bookkeeping is counted on whichever device the user happened to be
  // holding, so take the high-water mark of each counter rather than letting the
  // winning row's (possibly staler) numbers erase the other side's history. The
  // schedule itself follows the winner, since that's the most recent answer.
  return {
    ...winner,
    seenCount: Math.max(winner.seenCount, other.seenCount),
    reviewCount: maxDefined(winner.reviewCount, other.reviewCount),
    lapseCount: maxDefined(winner.lapseCount, other.lapseCount),
    lastLapseAt: laterDefined(winner.lastLapseAt, other.lastLapseAt),
  }
}

function maxDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a == null) return b
  if (b == null) return a
  return Math.max(a, b)
}

function laterDefined(a: string | undefined, b: string | undefined): string | undefined {
  if (a == null) return b
  if (b == null) return a
  return a >= b ? a : b
}

/**
 * Two devices studying on the same day each hold a partial count. Summing would
 * double-count on every re-merge (this function runs on every boot), so the
 * higher value wins — idempotent, at the cost of under-counting a day genuinely
 * split across devices.
 */
function betterDailyTime(a: DailyTime, b: DailyTime): DailyTime {
  const fuller = a.secondsStudied >= b.secondsStudied ? a : b
  const other = fuller === a ? b : a
  return {
    date: a.date,
    secondsStudied: fuller.secondsStudied,
    // The goal in force that day comes from the fuller record; taking a max
    // could retroactively raise the bar past a goalMetAt that already fired.
    goalSec: fuller.goalSec,
    // "First time the goal was reached", so the earlier stamp wins.
    goalMetAt: earlierDefined(fuller.goalMetAt, other.goalMetAt),
  }
}

function earlierDefined(a: string | null, b: string | null): string | null {
  if (a == null) return b
  if (b == null) return a
  return a <= b ? a : b
}

function betterPackageProgress(a: PackageProgress, b: PackageProgress): PackageProgress {
  if (!!a.masteredAt !== !!b.masteredAt) return a.masteredAt ? a : b
  if (!!a.completedAt !== !!b.completedAt) return a.completedAt ? a : b
  return a.currentIndex >= b.currentIndex ? a : b
}

/**
 * Sessions are append-only with no stable local id, so the merge unions them by
 * a natural key. `startedAt` is part of it: without it, two genuinely distinct
 * sessions of the same pack, mode and length on the same day collapsed into one
 * on every merge — which quietly under-counted exactly the users who study most.
 * Sessions written before that field existed fall back to the old loose key,
 * where the collision risk remains but the data is already historical.
 */
function sessionKey(s: Pick<Session, 'packageId' | 'date' | 'wordsCompleted' | 'mode' | 'startedAt'>): string {
  return `${s.packageId}|${s.date}|${s.wordsCompleted}|${s.mode}|${s.startedAt ?? ''}`
}

/**
 * One-time reconciliation on login: merges local IndexedDB progress with
 * whatever's already saved to the user's Supabase account (e.g. from another
 * device, or from before this device ever logged in), then writes the merged
 * result back to both sides. Safe to call on every boot — cheap at this data
 * volume, and idempotent.
 */
export async function pullAndMergeProgress(userId: string): Promise<void> {
  if (!supabase) return

  const [
    localSessions, localWords, localPackages, localDaily,
    remoteSessionsRes, remoteWordsRes, remotePackagesRes, remoteDailyRes,
  ] = await Promise.all([
    getAllSessions(),
    getAllWordProgress(),
    getAllPackageProgress(),
    getAllDailyTime(),
    supabase.from('sessions').select('*').eq('user_id', userId),
    supabase.from('word_progress').select('*').eq('user_id', userId),
    supabase.from('package_progress').select('*').eq('user_id', userId),
    supabase.from('daily_time').select('*').eq('user_id', userId),
  ])

  const remoteSessions = (remoteSessionsRes.data ?? []).map(r => ({
    packageId: r.package_id, date: r.date, startedAt: r.started_at ?? undefined,
    wordsCompleted: r.words_completed, mode: r.mode, autoplayMode: r.autoplay_mode ?? undefined,
    trainMode: r.train_mode ?? undefined, durationSec: r.duration_sec ?? undefined,
  })) as Omit<Session, 'id'>[]
  const remoteWords = (remoteWordsRes.data ?? []).map(r => ({
    wordId: r.word_id, packageId: r.package_id, seenCount: r.seen_count, lastSeen: r.last_seen, status: r.status,
    reviewCount: r.review_count ?? undefined, lapseCount: r.lapse_count ?? undefined,
    lastLapseAt: r.last_lapse_at ?? undefined, nextReviewAt: r.next_review_at ?? undefined,
  })) as WordProgress[]
  const remotePackages = (remotePackagesRes.data ?? []).map(r => ({
    packageId: r.package_id, startedAt: r.started_at, completedAt: r.completed_at, masteredAt: r.mastered_at, currentIndex: r.current_index,
  })) as PackageProgress[]
  const remoteDaily = (remoteDailyRes.data ?? []).map(r => ({
    date: r.date, secondsStudied: r.seconds_studied, goalSec: r.goal_sec, goalMetAt: r.goal_met_at ?? null,
  })) as DailyTime[]

  // --- word_progress / package_progress: merge by natural key, more-advanced side wins ---
  const wordMap = new Map<string, WordProgress>()
  for (const w of [...localWords, ...remoteWords]) {
    const existing = wordMap.get(w.wordId)
    wordMap.set(w.wordId, existing ? betterWordProgress(existing, w) : w)
  }
  const packageMap = new Map<string, PackageProgress>()
  for (const p of [...localPackages, ...remotePackages]) {
    const existing = packageMap.get(p.packageId)
    packageMap.set(p.packageId, existing ? betterPackageProgress(existing, p) : p)
  }
  const dailyMap = new Map<string, DailyTime>()
  for (const d of [...localDaily, ...remoteDaily]) {
    const existing = dailyMap.get(d.date)
    dailyMap.set(d.date, existing ? betterDailyTime(existing, d) : d)
  }

  // --- sessions: append-only log, union by a loose natural-key match ---
  const remoteSessionKeys = new Set(remoteSessions.map(sessionKey))
  const localOnlySessions = localSessions.filter(s => !remoteSessionKeys.has(sessionKey(s)))
  const localSessionKeys = new Set(localSessions.map(sessionKey))
  const remoteOnlySessions = remoteSessions.filter(s => !localSessionKeys.has(sessionKey(s)))

  const mergedWords = [...wordMap.values()]
  const mergedPackages = [...packageMap.values()]
  const mergedDaily = [...dailyMap.values()]

  const db = await getDB()

  await Promise.all([
    ...mergedWords.map(w => db.put('wordProgress', w)),
    ...mergedPackages.map(p => db.put('packageProgress', p)),
    ...mergedDaily.map(d => db.put('dailyTime', d)),
    ...remoteOnlySessions.map(s => db.add('sessions', s as Session)),
  ])

  await Promise.all([
    mergedWords.length && supabase.from('word_progress').upsert(
      mergedWords.map(w => ({
        user_id: userId, word_id: w.wordId, package_id: w.packageId,
        seen_count: w.seenCount, last_seen: w.lastSeen, status: w.status,
        review_count: w.reviewCount, lapse_count: w.lapseCount,
        last_lapse_at: w.lastLapseAt, next_review_at: w.nextReviewAt,
      }))
    ),
    mergedPackages.length && supabase.from('package_progress').upsert(
      mergedPackages.map(p => ({
        user_id: userId, package_id: p.packageId, started_at: p.startedAt,
        completed_at: p.completedAt, mastered_at: p.masteredAt, current_index: p.currentIndex,
      }))
    ),
    mergedDaily.length && supabase.from('daily_time').upsert(
      mergedDaily.map(d => ({
        user_id: userId, date: d.date, seconds_studied: d.secondsStudied,
        goal_sec: d.goalSec, goal_met_at: d.goalMetAt,
      }))
    ),
    localOnlySessions.length && supabase.from('sessions').insert(
      localOnlySessions.map(s => ({
        user_id: userId, package_id: s.packageId, date: s.date, started_at: s.startedAt,
        words_completed: s.wordsCompleted, mode: s.mode, autoplay_mode: s.autoplayMode,
        train_mode: s.trainMode, duration_sec: s.durationSec,
      }))
    ),
  ])

  // Anything cached off the old local state (the always-mounted streak/points
  // widget, in-flight progress snapshots) is stale now.
  emitProgress('reset')
}
