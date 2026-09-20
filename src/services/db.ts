import { openDB, DBSchema, IDBPDatabase } from 'idb'
import {
  Session, WordProgress, PackageProgress, DailyTime, ReviewLedgerEntry, LevelMasterySnapshot,
} from '../types/progress'
import { getSupabase, supabaseIfLoaded } from './supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { emitProgress } from './progressEvents'
import { showToast } from './toast'
import { dayKey, shiftDay, daysBetween } from '../utils/day'
import { studyDayKeys, streakFrom } from '../utils/studyDays'

// Best-effort push to the user's Supabase account — silent no-op when signed
// out or Supabase isn't configured. Local IndexedDB stays the source of truth
// for the app itself; this just mirrors writes out for cross-device sync.
// sessions is append-only (no stable natural key to upsert on locally), so it
// inserts a new row each time; word/package progress upsert on their natural keys.
//
// These use `supabaseIfLoaded()` rather than `await getSupabase()` deliberately:
// db.ts is reachable eagerly from useProgressData, so a single await here would
// pull @supabase/supabase-js straight back into the main bundle and undo the
// lazy split. Nothing is lost — a signed-in `user.id` can only have been set by
// the auth listener, which by then has the client — and these are fire-and-
// forget mirrors that must stay synchronous anyway.
// Failures are queued rather than logged and dropped — see the outbox below.
function syncInsert(table: 'sessions', row: Record<string, unknown>) {
  const userId = useAuthStore.getState().user?.id
  const supabase = supabaseIfLoaded()
  if (!supabase || !userId) return
  const payload = [{ ...row, user_id: userId }]
  // The two-argument form, not `.catch`: the query builder is a thenable, not
  // a real Promise, so a network-level rejection has nowhere else to land.
  supabase.from(table).insert(payload[0]).then(
    ({ error }) => { if (error) queueFailed(userId, 'insert', table, payload, error.message) },
    (err: unknown) => queueFailed(userId, 'insert', table, payload, String(err)),
  )
}

function syncUpsert(table: 'word_progress' | 'package_progress' | 'daily_time' | 'review_ledger', row: Record<string, unknown>) {
  const userId = useAuthStore.getState().user?.id
  const supabase = supabaseIfLoaded()
  if (!supabase || !userId) return
  const payload = [{ ...row, user_id: userId }]
  supabase.from(table).upsert(payload[0]).then(
    ({ error }) => { if (error) queueFailed(userId, 'upsert', table, payload, error.message) },
    (err: unknown) => queueFailed(userId, 'upsert', table, payload, String(err)),
  )
}

/** Same contract as syncUpsert, batched into one request — the shape
 *  progressSync.ts's pullAndMergeProgress already proves works against these
 *  tables. Used where writing hundreds/thousands of rows one at a time would
 *  be prohibitively slow (level mastery: up to 4535 words). */
function syncUpsertBatch(
  table: 'word_progress' | 'package_progress',
  rows: Record<string, unknown>[]
) {
  const userId = useAuthStore.getState().user?.id
  const supabase = supabaseIfLoaded()
  if (!supabase || !userId || rows.length === 0) return
  const payload = rows.map(r => ({ ...r, user_id: userId }))
  supabase.from(table).upsert(payload).then(
    ({ error }) => { if (error) queueFailed(userId, 'upsert', table, payload, error.message) },
    (err: unknown) => queueFailed(userId, 'upsert', table, payload, String(err)),
  )
}

// ── The outbox ──────────────────────────────────────────────────────────────
// The mirrors above are fire-and-forget by design (they must stay synchronous),
// which used to mean a write made on a train, on a flaky connection or against
// an expired token was logged once to the console and lost for good: the local
// row was right, the remote row was stale, and nothing ever reconciled them.
// A failed request is now parked here and replayed at the next opportunity —
// on boot, when the browser comes back online, and after any successful write.
//
// Entries carry their own user id. Replaying one account's queue into another
// would be the same contamination `claimProgressFor` exists to prevent.

export interface OutboxEntry {
  id?: number
  userId: string
  op: 'insert' | 'upsert'
  table: string
  rows: Record<string, unknown>[]
  queuedAt: string
}

/** Old, unreachable work shouldn't grow without bound — a queue this long
 *  means the account has been unreachable for a very long time, and the local
 *  data is still intact either way. */
const OUTBOX_MAX = 2000

function queueFailed(
  userId: string,
  op: OutboxEntry['op'],
  table: string,
  rows: Record<string, unknown>[],
  reason: string,
) {
  console.warn(`[progressSync] ${op} into ${table} failed (queued for retry):`, reason)
  void (async () => {
    try {
      const db = await getDB()
      const count = await db.count('syncOutbox')
      if (count >= OUTBOX_MAX) {
        console.error('[progressSync] outbox full — dropping the oldest entry')
        const oldest = await db.getAllKeys('syncOutbox', undefined, 1)
        if (oldest[0] != null) await db.delete('syncOutbox', oldest[0])
      }
      await db.add('syncOutbox', { userId, op, table, rows, queuedAt: new Date().toISOString() })
    } catch (err) {
      console.error('[progressSync] could not queue a failed write:', err)
    }
  })()
}

let flushing = false

/**
 * Replays whatever the mirrors couldn't deliver, oldest first.
 *
 * Stops at the first failure and leaves the rest queued: the entries are an
 * ordered log of the same rows, so replaying them out of order could write a
 * stale value over a newer one. Entries belonging to a different account are
 * dropped rather than sent.
 */
export async function flushOutbox(): Promise<number> {
  if (flushing) return 0
  const userId = useAuthStore.getState().user?.id
  const supabase = supabaseIfLoaded()
  if (!supabase || !userId) return 0

  flushing = true
  let sent = 0
  try {
    const db = await getDB()
    const entries = await db.getAll('syncOutbox')
    for (const entry of entries) {
      if (entry.id == null) continue
      if (entry.userId !== userId) {
        await db.delete('syncOutbox', entry.id)
        continue
      }
      const { error } = entry.op === 'insert'
        ? await supabase.from(entry.table).insert(entry.rows)
        : await supabase.from(entry.table).upsert(entry.rows)
      if (error) {
        console.warn('[progressSync] outbox still blocked:', error.message)
        break
      }
      await db.delete('syncOutbox', entry.id)
      sent++
    }
  } catch (err) {
    console.error('[progressSync] outbox flush failed:', err)
  } finally {
    flushing = false
  }
  if (sent > 0) console.info(`[progressSync] outbox: delivered ${sent} queued write(s)`)
  return sent
}

/** How many writes are still waiting to reach the account. */
export async function outboxSize(): Promise<number> {
  const db = await getDB()
  return db.count('syncOutbox')
}

function wordProgressRow(w: WordProgress) {
  return {
    word_id: w.wordId,
    package_id: w.packageId,
    seen_count: w.seenCount,
    last_seen: w.lastSeen,
    status: w.status,
    review_count: w.reviewCount,
    lapse_count: w.lapseCount,
    last_lapse_at: w.lastLapseAt,
    next_review_at: w.nextReviewAt,
    retired_at: w.retiredAt,
    stability: w.stability,
    difficulty: w.difficulty,
    declared_known_at: w.declaredKnownAt,
    declared_retired_at: w.declaredRetiredAt,
  }
}

function packageProgressRow(p: PackageProgress) {
  return {
    package_id: p.packageId,
    started_at: p.startedAt,
    completed_at: p.completedAt,
    mastered_at: p.masteredAt,
    listened_at: p.listenedAt ?? null,
    current_index: p.currentIndex,
  }
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
  reviewLedger: {
    key: string
    value: ReviewLedgerEntry
  }
  levelMastery: {
    key: number
    value: LevelMasterySnapshot
  }
  syncOutbox: {
    key: number
    value: OutboxEntry
  }
}

let dbPromise: Promise<IDBPDatabase<PEDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PEDB>('PE_DB', 9, {
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
        // v5: retiredAt on wordProgress — optional, written at put() time. The
        //     value store is schemaless, so no migration; the bump only forces
        //     the upgrade callback to run for the record.
        // v6: stability/difficulty on wordProgress are likewise optional (no
        //     store change); the per-day review ledger is a new store.
        if (oldVersion < 6) {
          db.createObjectStore('reviewLedger', { keyPath: 'date' })
        }
        // v7: the undo snapshot behind "Oznacz cały poziom jako opanowany" —
        // local-only by design, see services/levelMastery.ts.
        if (oldVersion < 7) {
          db.createObjectStore('levelMastery', { keyPath: 'level' })
        }
        // v8: listenedAt on packageProgress, splitting the listen axis off
        //     currentIndex — optional, written at put() time, so the bump only
        //     forces the upgrade callback to run for the record. Existing rows
        //     are backfilled from the session log by services/listenRepair.ts.
        // v9: the sync outbox — writes the Supabase mirror couldn't deliver,
        //     replayed when the account is reachable again. Local-only.
        if (oldVersion < 9) {
          db.createObjectStore('syncOutbox', { keyPath: 'id', autoIncrement: true })
        }
      },

      /* ── Version handover ──────────────────────────────────────────────────
         An IndexedDB upgrade cannot run while any connection to the older
         version is still open, and `openDB` then simply never settles: no
         error, no rejection, nothing in the console. Every screen that reads
         progress — the session hero, the path strip, the streak pill — waits
         on getDB() forever and sits on its skeleton, while the static parts of
         the page render normally and make it look like a styling bug.

         That is not hypothetical: it is what a second tab does, and in dev
         it is also what an HMR reload of this module does, since the previous
         module instance keeps its connection. Version 9 made it reachable for
         everyone who had already run version 7. */

      // Someone else wants to upgrade and this connection is what's in the
      // way. Let go — the next getDB() reopens on the new version.
      blocking() {
        const opening = dbPromise
        dbPromise = null
        void opening?.then(db => db.close()).catch(() => {})
      },

      // We're the one being held back. The open never settles, so every screen
      // that reads progress sits on its skeleton forever — say so where the
      // user can actually see it, not just in a console they aren't watching.
      // A tab still running a build from before `blocking()` existed cannot
      // hand over on its own; closing it is the only way out.
      blocked(currentVersion, blockedVersion) {
        console.error(
          `[db] PE_DB ${currentVersion} → ${blockedVersion} is blocked by another open connection ` +
          '(another tab of this app, or a stale one after an HMR reload). Nothing that reads ' +
          'progress can load until it closes.'
        )
        showToast('Aplikacja jest otwarta w innej karcie i blokuje aktualizację bazy. Zamknij pozostałe karty i odśwież tę.', { icon: '⚠️' })
      },

      // Storage evicted the connection under us; drop the handle so the next
      // caller opens a fresh one instead of reusing a dead database.
      terminated() {
        dbPromise = null
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
  syncUpsert('word_progress', wordProgressRow(wp))
  emitProgress('word')
}

// The canonical "due" list is snapshot.dueWords, computed in one pass in
// fetchSnapshot (src/hooks/useProgressData.ts) alongside knownMap etc. A separate
// getDueWordProgress() query used to exist here — removed to keep a single
// definition of the predicate.

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

export async function savePackageProgress(pp: PackageProgress): Promise<void> {
  const db = await getDB()
  await db.put('packageProgress', pp)
  syncUpsert('package_progress', packageProgressRow(pp))
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

/** Mirrored tables, in the order a full wipe clears them. `levelMastery` is
 *  absent on purpose — it is local-only (see services/levelMastery.ts). */
const SYNCED_TABLES = ['word_progress', 'package_progress', 'sessions', 'daily_time', 'review_ledger'] as const

/**
 * Deletes the signed-in user's rows and WAITS for the result, unlike the
 * fire-and-forget mirrors above. Nothing in the sync layer has a tombstone: the
 * merge on the next sign-in is a plain union of local and remote, so a row left
 * behind up there comes back down here. A delete that has to stick therefore
 * cannot be fire-and-forget.
 *
 * No account (or Supabase not configured) means there is nothing remote to
 * clear, and the local wipe alone is the whole truth.
 */
async function deleteRemoteRows(
  table: (typeof SYNCED_TABLES)[number],
  ids?: { column: 'word_id' | 'package_id'; values: string[] },
): Promise<void> {
  const userId = useAuthStore.getState().user?.id
  const supabase = await getSupabase()
  if (!supabase || !userId) return
  if (ids && ids.values.length === 0) return

  // Chunked: PostgREST puts the `in` list in the URL, and a few thousand ids
  // is a request line no proxy will accept.
  const chunks = ids
    ? Array.from({ length: Math.ceil(ids.values.length / 300) }, (_, i) => ids.values.slice(i * 300, i * 300 + 300))
    : [null]
  for (const chunk of chunks) {
    let q = supabase.from(table).delete().eq('user_id', userId)
    if (chunk && ids) q = q.in(ids.column, chunk)
    const { error } = await q
    if (error) throw new Error(`[progressSync] deleting from ${table} failed: ${error.message}`)
  }
}

/**
 * Wipes everything, on both sides.
 *
 * The remote delete goes FIRST and the local wipe only follows if it succeeded:
 * clearing IndexedDB alone looks like a reset until the next sign-in hands the
 * whole account straight back, and the modal calls this "Nieodwracalna
 * operacja". Throwing leaves the user with their progress intact, which is the
 * safe half of the two failure modes.
 */
export async function resetAllProgress(): Promise<void> {
  for (const table of SYNCED_TABLES) await deleteRemoteRows(table)

  const db = await getDB()
  await Promise.all([
    db.clear('wordProgress'),
    db.clear('packageProgress'),
    db.clear('sessions'),
    db.clear('dailyTime'),
    // Cleared here too, now that the remote side is: leaving the local ledger
    // behind would simply re-upload it on the next merge.
    db.clear('reviewLedger'),
    db.clear('levelMastery'),
  ])
  emitProgress('reset')
}

const PROGRESS_OWNER_KEY = 'lp_progress_owner'

/**
 * Keeps one device's stores from leaking between accounts.
 *
 * Signing out doesn't (and shouldn't) wipe IndexedDB — without an outbox, an
 * unsynced session would be destroyed by the act of signing out. But the merge
 * on sign-in is a union of local and remote, so when a DIFFERENT user then
 * signs in on the same device, everything the previous one studied was
 * absorbed into their account. The owner stamp makes that case, and only that
 * case, clear the local stores first.
 *
 * An unclaimed store belongs to whoever signs in first — that's the documented
 * "progress from before this device ever logged in" path, and it still works.
 */
export async function claimProgressFor(userId: string): Promise<void> {
  const owner = localStorage.getItem(PROGRESS_OWNER_KEY)
  if (owner === userId) return

  if (owner != null) {
    const db = await getDB()
    await Promise.all([
      db.clear('wordProgress'),
      db.clear('packageProgress'),
      db.clear('sessions'),
      db.clear('dailyTime'),
      db.clear('reviewLedger'),
      // Local-only and device-scoped: an undo snapshot belongs to the
      // declaration that made it, not to the next person on this phone.
      db.clear('levelMastery'),
      // Queued writes belong to the previous account and must never be
      // replayed into this one.
      db.clear('syncOutbox'),
    ])
    emitProgress('reset')
  }
  localStorage.setItem(PROGRESS_OWNER_KEY, userId)
}

export async function resetProgressForPackages(packageIds: string[]): Promise<void> {
  const db = await getDB()

  // Remote first, same reasoning as resetAllProgress. Word ids are read before
  // anything is deleted locally, since that read is also what names the rows to
  // remove up there.
  const wordIdsToDelete = (await db.getAll('wordProgress'))
    .filter(w => packageIds.includes(w.packageId))
    .map(w => w.wordId)
  await deleteRemoteRows('package_progress', { column: 'package_id', values: packageIds })
  await deleteRemoteRows('word_progress', { column: 'word_id', values: wordIdsToDelete })
  await deleteRemoteRows('sessions', { column: 'package_id', values: packageIds })

  const tx1 = db.transaction('packageProgress', 'readwrite')
  await Promise.all(packageIds.map(id => tx1.store.delete(id)))
  await tx1.done

  const tx2 = db.transaction('wordProgress', 'readwrite')
  await Promise.all(wordIdsToDelete.map(id => tx2.store.delete(id)))
  await tx2.done

  const allSessions = await db.getAll('sessions')
  const sessionsToDelete = allSessions.filter(s => packageIds.includes(s.packageId) && s.id != null).map(s => s.id!)
  const tx3 = db.transaction('sessions', 'readwrite')
  await Promise.all(sessionsToDelete.map(id => tx3.store.delete(id)))
  await tx3.done

  // A level's undo snapshot references specific package rows; if any of them
  // just got wiped, the snapshot can no longer restore truthfully — drop it
  // rather than leave "Cofnij" pointing at data that no longer exists.
  const levelSnapshots = await db.getAll('levelMastery')
  const staleLevels = levelSnapshots
    .filter(s => s.packages.some(p => packageIds.includes(p.packageId)))
    .map(s => s.level)
  if (staleLevels.length > 0) {
    const tx4 = db.transaction('levelMastery', 'readwrite')
    await Promise.all(staleLevels.map(lvl => tx4.store.delete(lvl)))
    await tx4.done
  }

  emitProgress('reset')
}

// ── Level mastery ("Oznacz cały poziom jako opanowany") ─────────────────────
// See services/levelMastery.ts for the orchestration (fetching pack content,
// building the snapshot, deciding per-word how to mutate). This layer only
// knows how to write/restore rows atomically and cheaply at scale.

export async function getLevelMasterySnapshot(level: number): Promise<LevelMasterySnapshot | undefined> {
  const db = await getDB()
  return db.get('levelMastery', level)
}

export async function getAllLevelMasterySnapshots(): Promise<LevelMasterySnapshot[]> {
  const db = await getDB()
  return db.getAll('levelMastery')
}

/**
 * Writes every word/package row for a level, plus its undo snapshot, in one
 * IndexedDB transaction — extends the batch-delete pattern already
 * established by resetProgressForPackages to a batch write. The Supabase
 * mirror goes out as ONE upsert per table (word_progress/package_progress),
 * not one request per word — see progressSync.ts's pullAndMergeProgress for
 * the proof this shape already works against these tables.
 */
export async function saveLevelMastery(
  snapshot: LevelMasterySnapshot,
  words: WordProgress[],
  packages: PackageProgress[],
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['wordProgress', 'packageProgress', 'levelMastery'], 'readwrite')
  await Promise.all([
    ...words.map(w => tx.objectStore('wordProgress').put(w)),
    ...packages.map(p => tx.objectStore('packageProgress').put(p)),
    tx.objectStore('levelMastery').put(snapshot),
  ])
  await tx.done

  syncUpsertBatch('word_progress', words.map(wordProgressRow))
  syncUpsertBatch('package_progress', packages.map(packageProgressRow))

  emitProgress('word')
  emitProgress('package')
}

/**
 * "Cofnij": restores every word/package to its exact pre-mark row (or deletes
 * it, if it didn't exist before), then drops the snapshot.
 *
 * The removals go out to Supabase FIRST and are awaited. They used to be fire
 * and forget, which meant an undo performed offline — or one whose request
 * simply failed — left the declared rows standing up there, and the next
 * sign-in merged them straight back: the undo silently undid itself. Failing
 * here instead leaves the declaration in place, which the user can retry.
 */
export async function undoLevelMastery(level: number): Promise<void> {
  const db = await getDB()
  const snapshot = await db.get('levelMastery', level)
  if (!snapshot) return

  await deleteRemoteRows('word_progress', {
    column: 'word_id',
    values: snapshot.words.filter(w => w.prev == null).map(w => w.wordId),
  })
  await deleteRemoteRows('package_progress', {
    column: 'package_id',
    values: snapshot.packages.filter(p => p.prev == null).map(p => p.packageId),
  })

  const tx = db.transaction(['wordProgress', 'packageProgress', 'levelMastery'], 'readwrite')
  const wpStore = tx.objectStore('wordProgress')
  const ppStore = tx.objectStore('packageProgress')
  await Promise.all([
    ...snapshot.words.map(w => (w.prev ? wpStore.put(w.prev) : wpStore.delete(w.wordId))),
    ...snapshot.packages.map(p => (p.prev ? ppStore.put(p.prev) : ppStore.delete(p.packageId))),
    tx.objectStore('levelMastery').delete(level),
  ])
  await tx.done

  const restoredWords = snapshot.words.map(w => w.prev).filter((w): w is WordProgress => w != null)
  const restoredPackages = snapshot.packages.map(p => p.prev).filter((p): p is PackageProgress => p != null)

  syncUpsertBatch('word_progress', restoredWords.map(wordProgressRow))
  syncUpsertBatch('package_progress', restoredPackages.map(packageProgressRow))

  emitProgress('word')
  emitProgress('package')
}

/**
 * Current run of consecutive study days, counting back from today.
 *
 * Counts a day studied if a session landed on it OR the daily-time ledger
 * recorded real study — see utils/studyDays. Sessions alone used to decide this,
 * which meant someone who studies every evening but never finishes a pack had a
 * streak of zero while the app happily awarded them "cel dnia" for the same
 * days.
 *
 * `frozenDays` are days the user missed but spent a streak freeze on. They keep
 * the chain unbroken without being counted as study — a freeze protects the
 * streak, it doesn't fake a session.
 */
export async function getStreak(frozenDays: string[] = []): Promise<number> {
  const db = await getDB()
  const [sessions, dailyTime] = await Promise.all([
    db.getAll('sessions'),
    db.getAll('dailyTime'),
  ])

  const studied = studyDayKeys(sessions, dailyTime)
  if (studied.size === 0) return 0

  return streakFrom(studied, new Set(frozenDays), dayKey(), d => shiftDay(-1, d))
}

/**
 * Longest run of consecutive study days across all of history, not just the
 * current run. Deliberately ignores freezes: a personal record should reflect
 * days actually studied.
 */
export async function getLongestStreak(): Promise<number> {
  const db = await getDB()
  const [sessions, dailyTime] = await Promise.all([
    db.getAll('sessions'),
    db.getAll('dailyTime'),
  ])

  const dates = [...studyDayKeys(sessions, dailyTime)].sort()
  if (dates.length === 0) return 0

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

// ── Review ledger ───────────────────────────────────────────────────────────
// One row per day recording whether that day's review serving was cleared.
// Powers the "czysta trasa" (cleanDays) achievement — see services/achievements.ts.

export async function getAllReviewLedger(): Promise<ReviewLedgerEntry[]> {
  const db = await getDB()
  return db.getAll('reviewLedger')
}

export async function getReviewLedgerEntry(date: string): Promise<ReviewLedgerEntry | undefined> {
  const db = await getDB()
  return db.get('reviewLedger', date)
}

export async function saveReviewLedger(entry: ReviewLedgerEntry): Promise<void> {
  const db = await getDB()
  await db.put('reviewLedger', entry)
  syncUpsert('review_ledger', {
    date: entry.date,
    cleared: entry.cleared,
    cleared_at: entry.clearedAt,
  })
  emitProgress('reviewLedger')
}
