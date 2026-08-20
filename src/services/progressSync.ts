import { supabase } from './supabaseClient'
import { getAllSessions, getAllWordProgress, getAllPackageProgress, getDB } from './db'
import { Session, WordProgress, PackageProgress, WordStatus } from '../types/progress'

const STATUS_RANK: Record<WordStatus, number> = { new: 0, learning: 1, known: 2 }

function betterWordProgress(a: WordProgress, b: WordProgress): WordProgress {
  if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) {
    return STATUS_RANK[a.status] > STATUS_RANK[b.status] ? a : b
  }
  return a.lastSeen >= b.lastSeen ? a : b
}

function betterPackageProgress(a: PackageProgress, b: PackageProgress): PackageProgress {
  if (!!a.masteredAt !== !!b.masteredAt) return a.masteredAt ? a : b
  if (!!a.completedAt !== !!b.completedAt) return a.completedAt ? a : b
  return a.currentIndex >= b.currentIndex ? a : b
}

function sessionKey(s: Pick<Session, 'packageId' | 'date' | 'wordsCompleted' | 'mode'>): string {
  return `${s.packageId}|${s.date}|${s.wordsCompleted}|${s.mode}`
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

  const [localSessions, localWords, localPackages, remoteSessionsRes, remoteWordsRes, remotePackagesRes] = await Promise.all([
    getAllSessions(),
    getAllWordProgress(),
    getAllPackageProgress(),
    supabase.from('sessions').select('*').eq('user_id', userId),
    supabase.from('word_progress').select('*').eq('user_id', userId),
    supabase.from('package_progress').select('*').eq('user_id', userId),
  ])

  const remoteSessions = (remoteSessionsRes.data ?? []).map(r => ({
    packageId: r.package_id, date: r.date, wordsCompleted: r.words_completed, mode: r.mode,
  })) as Omit<Session, 'id'>[]
  const remoteWords = (remoteWordsRes.data ?? []).map(r => ({
    wordId: r.word_id, packageId: r.package_id, seenCount: r.seen_count, lastSeen: r.last_seen, status: r.status,
  })) as WordProgress[]
  const remotePackages = (remotePackagesRes.data ?? []).map(r => ({
    packageId: r.package_id, startedAt: r.started_at, completedAt: r.completed_at, masteredAt: r.mastered_at, currentIndex: r.current_index,
  })) as PackageProgress[]

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

  // --- sessions: append-only log, union by a loose natural-key match ---
  const remoteSessionKeys = new Set(remoteSessions.map(sessionKey))
  const localOnlySessions = localSessions.filter(s => !remoteSessionKeys.has(sessionKey(s)))
  const localSessionKeys = new Set(localSessions.map(sessionKey))
  const remoteOnlySessions = remoteSessions.filter(s => !localSessionKeys.has(sessionKey(s)))

  const mergedWords = [...wordMap.values()]
  const mergedPackages = [...packageMap.values()]

  const db = await getDB()

  await Promise.all([
    ...mergedWords.map(w => db.put('wordProgress', w)),
    ...mergedPackages.map(p => db.put('packageProgress', p)),
    ...remoteOnlySessions.map(s => db.add('sessions', s as Session)),
  ])

  await Promise.all([
    mergedWords.length && supabase.from('word_progress').upsert(
      mergedWords.map(w => ({
        user_id: userId, word_id: w.wordId, package_id: w.packageId,
        seen_count: w.seenCount, last_seen: w.lastSeen, status: w.status,
      }))
    ),
    mergedPackages.length && supabase.from('package_progress').upsert(
      mergedPackages.map(p => ({
        user_id: userId, package_id: p.packageId, started_at: p.startedAt,
        completed_at: p.completedAt, mastered_at: p.masteredAt, current_index: p.currentIndex,
      }))
    ),
    localOnlySessions.length && supabase.from('sessions').insert(
      localOnlySessions.map(s => ({
        user_id: userId, package_id: s.packageId, date: s.date,
        words_completed: s.wordsCompleted, mode: s.mode,
      }))
    ),
  ])
}
