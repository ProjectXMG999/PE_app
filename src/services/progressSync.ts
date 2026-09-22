import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from './supabaseClient'
import {
  getAllSessions, getAllWordProgress, getAllPackageProgress, getAllDailyTime,
  getAllReviewLedger, getDB, flushOutbox,
} from './db'
import {
  Session, WordProgress, PackageProgress, WordStatus, DailyTime, ReviewLedgerEntry,
} from '../types/progress'
import { emitProgress } from './progressEvents'
import { repairListenAxis } from './listenRepair'
import { RETIRE_STABILITY_DAYS } from './reviewConfig'
import { nextInterval } from './fsrs'
import { currentRequestRetention } from '../store/useAppStore'
import { dayKey, shiftDay } from '../utils/day'

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
  //
  // `retiredAt` deliberately rides along with `...winner` and is NOT merged: a
  // `laterDefined`/`maxDefined` there would resurrect a graduation that the more
  // recent lapse on the other device just cleared. Same for `stability` /
  // `difficulty` — they're a coherent pair from the winner's last review, not
  // a per-field max. All three stay consistent with `nextReviewAt`.
  const merged: WordProgress = {
    ...winner,
    seenCount: Math.max(winner.seenCount, other.seenCount),
    reviewCount: maxDefined(winner.reviewCount, other.reviewCount),
    lapseCount: maxDefined(winner.lapseCount, other.lapseCount),
    lastLapseAt: laterDefined(winner.lastLapseAt, other.lastLapseAt),
  }

  // Normalise: keep retiredAt / nextReviewAt consistent with the merged FSRS
  // stability (in case the two sides disagreed on retirement) — but never for
  // a level-mastery declaration. That retirement is a deliberate, permanent
  // claim independent of `stability` (a word can be pulled out of rotation
  // long before it would earn durable retirement on its own merits), so this
  // FSRS-consistency repair must not resurrect its schedule or clear its
  // retiredAt on the next cross-device merge.
  if (merged.stability != null && merged.declaredRetiredAt == null) {
    const durable = merged.stability >= RETIRE_STABILITY_DAYS
    if (!durable) merged.retiredAt = undefined
    if (merged.nextReviewAt == null) {
      // Same desired retention the study screens schedule with, so a repaired
      // date doesn't sit on a different curve from every other word.
      merged.nextReviewAt = shiftDay(
        nextInterval(merged.stability, currentRequestRetention()), dayKey()
      )
    }
  }
  return merged
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

/**
 * Composed field by field rather than by picking a winning row. The old rule
 * returned whichever side looked "more advanced" whole — so a remote row
 * carrying `masteredAt` and `currentIndex: 0` erased a genuine listen position
 * on the other device, and the three axes could never disagree without one of
 * them losing. They're independent now: the pack is listened/worked/mastered
 * if EITHER side got there, dated to the first time it happened, and the
 * resume pointer is simply the furthest either device played.
 *
 * Exported for the tests — this is the subtlest logic in the sync layer and
 * the one place a cross-device merge can silently undo real progress.
 */
export function betterPackageProgress(a: PackageProgress, b: PackageProgress): PackageProgress {
  return {
    packageId: a.packageId,
    startedAt: a.startedAt <= b.startedAt ? a.startedAt : b.startedAt,
    currentIndex: Math.max(a.currentIndex, b.currentIndex),
    listenedAt: earlierDefined(a.listenedAt ?? null, b.listenedAt ?? null),
    completedAt: earlierDefined(a.completedAt, b.completedAt),
    masteredAt: earlierDefined(a.masteredAt, b.masteredAt),
  }
}

/**
 * Sessions are append-only with no stable local id, so the merge unions them by
 * a natural key. `startedAt` is part of it: without it, two genuinely distinct
 * sessions of the same pack, mode and length on the same day collapsed into one
 * on every merge — which quietly under-counted exactly the users who study most.
 * Sessions written before that field existed fall back to the old loose key,
 * where the collision risk remains but the data is already historical.
 *
 * The timestamp MUST be normalised rather than compared as written, because the
 * two sides spell the same instant differently. Locally it is
 * `new Date().toISOString()` → `2026-09-20T10:11:12.345Z`; remotely the column
 * is `timestamptz` (migration 0003) and PostgREST renders it
 * `2026-09-20T10:11:12.345+00:00`. Those strings never match, so every session
 * looked local-only to the push AND remote-only to the pull: each merge
 * re-inserted the whole log remotely and re-added the whole log locally. The
 * table grew on every sign-in, and with it study time, words completed, the
 * streak and the readiness score — all of which are derived from it.
 */
function isoStamp(t: string | undefined): string {
  if (!t) return ''
  const ms = Date.parse(t)
  // An unparseable value keeps its literal spelling: still a stable key, and
  // still matches itself on both sides.
  return Number.isNaN(ms) ? t : new Date(ms).toISOString()
}

export function sessionKey(s: Pick<Session, 'packageId' | 'date' | 'wordsCompleted' | 'mode' | 'startedAt'>): string {
  return `${s.packageId}|${s.date}|${s.wordsCompleted}|${s.mode}|${isoStamp(s.startedAt)}`
}

/** PostgREST caps a response at the project's `db-max-rows` (1000 on hosted
 *  Supabase by default), silently — a truncated page looks exactly like a
 *  complete one. A single level declaration writes up to 4535 word_progress
 *  rows, so an unpaginated read handed a fresh device a fraction of the
 *  account's history and then pushed that fraction back as the merged truth.
 *  Pages until a short one comes back. */
const PAGE = 1000

/** A row as PostgREST returns it from `select('*')` — snake_case and untyped.
 *  The mappers below turn each one into its camelCase TS type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RemoteRow = Record<string, any>

async function selectAllRows(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  /** A column unique per user — paging without a stable order can repeat or
   *  skip rows between requests. Each of these tables has one in its key. */
  orderBy: string,
): Promise<RemoteRow[]> {
  const rows: RemoteRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table).select('*').eq('user_id', userId)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1)
    // Thrown, not swallowed: `data ?? []` would make a failed read
    // indistinguishable from an empty account, and the merge would then treat
    // the remote side as blank and overwrite it with whatever is local.
    if (error) throw new Error(`[progressSync] reading ${table} failed: ${error.message}`)
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

/** Upserts in bounded batches. One request per few thousand rows is a
 *  multi-megabyte body that times out or gets rejected whole; each batch is
 *  awaited so a failure surfaces instead of vanishing into a floating promise. */
async function upsertAll(
  supabase: SupabaseClient,
  table: string,
  rows: RemoteRow[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += SYNC_BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + SYNC_BATCH))
    if (error) throw new Error(`[progressSync] writing ${table} failed: ${error.message}`)
  }
}

const SYNC_BATCH = 500

/**
 * One-time reconciliation on login: merges local IndexedDB progress with
 * whatever's already saved to the user's Supabase account (e.g. from another
 * device, or from before this device ever logged in), then writes the merged
 * result back to both sides. Safe to call on every boot — cheap at this data
 * volume, and idempotent.
 */
export async function pullAndMergeProgress(userId: string): Promise<void> {
  // Already async, and only ever called from handleSession — i.e. after the
  // client has loaded — so awaiting the accessor here costs nothing.
  const supabase = await getSupabase()
  if (!supabase) return

  const [
    localSessions, localWords, localPackages, localDaily, localLedger,
    remoteSessionRows, remoteWordRows, remotePackageRows, remoteDailyRows, remoteLedgerRows,
  ] = await Promise.all([
    getAllSessions(),
    getAllWordProgress(),
    getAllPackageProgress(),
    getAllDailyTime(),
    getAllReviewLedger(),
    selectAllRows(supabase, 'sessions', userId, 'id'),
    selectAllRows(supabase, 'word_progress', userId, 'word_id'),
    selectAllRows(supabase, 'package_progress', userId, 'package_id'),
    selectAllRows(supabase, 'daily_time', userId, 'date'),
    selectAllRows(supabase, 'review_ledger', userId, 'date'),
  ])

  const remoteSessions = remoteSessionRows.map(r => ({
    packageId: r.package_id, date: r.date, startedAt: r.started_at ?? undefined,
    wordsCompleted: r.words_completed, mode: r.mode, autoplayMode: r.autoplay_mode ?? undefined,
    trainMode: r.train_mode ?? undefined, durationSec: r.duration_sec ?? undefined,
  })) as Omit<Session, 'id'>[]
  const remoteWords = remoteWordRows.map(r => ({
    wordId: r.word_id, packageId: r.package_id, seenCount: r.seen_count, lastSeen: r.last_seen, status: r.status,
    reviewCount: r.review_count ?? undefined, lapseCount: r.lapse_count ?? undefined,
    lastLapseAt: r.last_lapse_at ?? undefined, nextReviewAt: r.next_review_at ?? undefined,
    retiredAt: r.retired_at ?? undefined,
    stability: r.stability ?? undefined, difficulty: r.difficulty ?? undefined,
    declaredKnownAt: r.declared_known_at ?? undefined, declaredRetiredAt: r.declared_retired_at ?? undefined,
    assertedKnownAt: r.asserted_known_at ?? undefined,
  })) as WordProgress[]
  const remotePackages = remotePackageRows.map(r => ({
    packageId: r.package_id, startedAt: r.started_at, completedAt: r.completed_at, masteredAt: r.mastered_at,
    listenedAt: r.listened_at ?? null, currentIndex: r.current_index,
  })) as PackageProgress[]
  const remoteDaily = remoteDailyRows.map(r => ({
    date: r.date, secondsStudied: r.seconds_studied, goalSec: r.goal_sec, goalMetAt: r.goal_met_at ?? null,
  })) as DailyTime[]
  const remoteLedger = remoteLedgerRows.map(r => ({
    date: r.date, cleared: !!r.cleared, clearedAt: r.cleared_at ?? null,
  })) as ReviewLedgerEntry[]

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
  // Review ledger: OR the flag — if either device cleared the day, it's cleared.
  const ledgerMap = new Map<string, ReviewLedgerEntry>()
  for (const e of [...localLedger, ...remoteLedger]) {
    const prev = ledgerMap.get(e.date)
    ledgerMap.set(e.date, {
      date: e.date,
      cleared: (prev?.cleared ?? false) || e.cleared,
      clearedAt: earlierDefined(prev?.clearedAt ?? null, e.clearedAt),
    })
  }

  // --- sessions: append-only log, union by a loose natural-key match ---
  const remoteSessionKeys = new Set(remoteSessions.map(sessionKey))
  const localOnlySessions = localSessions.filter(s => !remoteSessionKeys.has(sessionKey(s)))
  const localSessionKeys = new Set(localSessions.map(sessionKey))
  const remoteOnlySessions = remoteSessions.filter(s => !localSessionKeys.has(sessionKey(s)))

  const mergedWords = [...wordMap.values()]
  const mergedPackages = [...packageMap.values()]
  const mergedDaily = [...dailyMap.values()]
  const mergedLedger = [...ledgerMap.values()]

  const db = await getDB()

  // One transaction across all five stores, not ~12 000 independent puts.
  // Independent puts commit independently, so a failure part-way through left
  // the device holding half a merge — most visibly word rows without the
  // package rows that go with them, which is a pack reading "15 / 15 słów" with
  // no "★ Opanowana" on it: the flag lives in `packageProgress`, the count in
  // `wordProgress`. Either the whole merge lands or none of it does.
  const tx = db.transaction(
    ['wordProgress', 'packageProgress', 'dailyTime', 'reviewLedger', 'sessions'],
    'readwrite',
  )
  await Promise.all([
    ...mergedWords.map(w => tx.objectStore('wordProgress').put(w)),
    ...mergedPackages.map(p => tx.objectStore('packageProgress').put(p)),
    ...mergedDaily.map(d => tx.objectStore('dailyTime').put(d)),
    ...mergedLedger.map(e => tx.objectStore('reviewLedger').put(e)),
    ...remoteOnlySessions.map(s => tx.objectStore('sessions').add(s as Session)),
  ])
  await tx.done

  // The device now holds the merged truth, and everything downstream of here is
  // about the *mirror*. Emitted before the push rather than only after it,
  // because a push that throws used to skip this line entirely: the merged rows
  // sat in IndexedDB while every screen went on rendering the 60-second cached
  // snapshot taken before them. That is how a pack the server had long since
  // marked mastered kept reading "15 / 15" with no star until the next reload.
  emitProgress('reset')

  // Everything from here on is the MIRROR, not the device. It is allowed to
  // fail — the caller turns that into "nie udało się zsynchronizować" and a
  // retry — but it must not skip the local upkeep below it, which is what a
  // bare `await` chain did.
  let pushError: unknown = null
  try {
    // Batched and awaited. A committed learner merges thousands of word rows,
    // and one upsert of all of them is a multi-megabyte body — previously fired
    // and forgotten, so a rejection left the two sides silently disagreeing.
    await upsertAll(supabase, 'word_progress', mergedWords.map(w => ({
      user_id: userId, word_id: w.wordId, package_id: w.packageId,
      seen_count: w.seenCount, last_seen: w.lastSeen, status: w.status,
      review_count: w.reviewCount, lapse_count: w.lapseCount,
      last_lapse_at: w.lastLapseAt, next_review_at: w.nextReviewAt,
      retired_at: w.retiredAt,
      stability: w.stability, difficulty: w.difficulty,
      declared_known_at: w.declaredKnownAt, declared_retired_at: w.declaredRetiredAt,
      asserted_known_at: w.assertedKnownAt,
    })))
    await upsertAll(supabase, 'package_progress', mergedPackages.map(p => ({
      user_id: userId, package_id: p.packageId, started_at: p.startedAt,
      completed_at: p.completedAt, mastered_at: p.masteredAt,
      listened_at: p.listenedAt ?? null, current_index: p.currentIndex,
    })))
    await upsertAll(supabase, 'daily_time', mergedDaily.map(d => ({
      user_id: userId, date: d.date, seconds_studied: d.secondsStudied,
      goal_sec: d.goalSec, goal_met_at: d.goalMetAt,
    })))
    await upsertAll(supabase, 'review_ledger', mergedLedger.map(e => ({
      user_id: userId, date: e.date, cleared: e.cleared, cleared_at: e.clearedAt,
    })))
    await appendSessions(supabase, userId, localOnlySessions)
  } catch (err) {
    pushError = err
  }

  // The merge can pull in rows written by a device that predates the listen
  // axis, so the repair has to run on the merged result too — a boot-only pass
  // would be undone by the next sign-in and never converge.
  try { await repairListenAxis() } catch (err) { console.error('[listen] repair after merge failed:', err) }

  // The account is demonstrably reachable right now, so this is the best
  // moment to clear anything the mirrors couldn't deliver earlier. Skipped
  // when the push just failed — the account is plainly not reachable.
  if (!pushError) {
    try { await flushOutbox() } catch (err) { console.error('[progressSync] flush after merge failed:', err) }
  }

  // The listen repair above may have rewritten rows; re-emit so the UI reads
  // the final state either way.
  emitProgress('reset')

  // Reported last, so the caller's toast and retry still happen — after the
  // device itself has been brought fully up to date.
  if (pushError) throw pushError
}

/**
 * Mirrors sessions the account hasn't seen. Append-only, so this one inserts
 * rather than upserts.
 *
 * Logged, not thrown — unlike every read and every upsert around it. By this
 * point the four tables that actually carry learning progress are written and
 * the account is demonstrably reachable, so a failure here is not "the sync
 * broke", it is "the session log couldn't be appended". Throwing made those
 * two indistinguishable: it surfaced as a toast telling the user their
 * progress had failed to sync, and it cleared `lastSyncedUserId` in
 * useAuthStore, re-arming the identical doomed write on every auth event.
 *
 * That is exactly what a schema drift did (see migration 0010 — the CHECK on
 * `train_mode` predated the Inteligentny mode), and the failure mode is
 * permanent by nature: a rejected row is rejected the same way every time.
 * Nothing is lost by continuing. These sessions stay local-only, so the next
 * merge retries them, and the moment the schema catches up they land.
 */
async function appendSessions(
  supabase: SupabaseClient,
  userId: string,
  localOnlySessions: Omit<Session, 'id'>[],
): Promise<void> {
  let sessionsFailed = 0
  for (let i = 0; i < localOnlySessions.length; i += SYNC_BATCH) {
    const { error } = await supabase.from('sessions').insert(
      localOnlySessions.slice(i, i + SYNC_BATCH).map(s => ({
        user_id: userId, package_id: s.packageId, date: s.date, started_at: s.startedAt,
        words_completed: s.wordsCompleted, mode: s.mode, autoplay_mode: s.autoplayMode,
        train_mode: s.trainMode, duration_sec: s.durationSec,
      }))
    )
    if (error) {
      sessionsFailed += Math.min(SYNC_BATCH, localOnlySessions.length - i)
      console.error(`[progressSync] appending sessions failed (${error.code ?? 'no code'}):`, error.message)
    }
  }
  if (sessionsFailed > 0) {
    console.error(
      `[progressSync] ${sessionsFailed} session row(s) could not be mirrored. ` +
      'Local progress is unaffected; they will be retried on the next merge.'
    )
  }
}
