import packagesIndex from '../data/packages-index.json'
import { Pack, PackMeta } from '../types/vocabulary'
import {
  WordProgress, PackageProgress, LevelMasterySnapshot,
  LevelMasteryWordEntry, LevelMasteryPackageEntry,
} from '../types/progress'
import { fetchPack, PackFetchError } from '../hooks/usePackageData'
import {
  getAllWordProgress, getAllPackageProgress, saveLevelMastery, undoLevelMastery,
  getLevelMasterySnapshot,
} from './db'
import { isDeclaredKnownWord } from './review'
import { LEVEL_MASTERY_FETCH_CONCURRENCY } from './reviewConfig'

const allPacks = packagesIndex as PackMeta[]

export function packageIdsForLevel(level: number): string[] {
  return allPacks.filter(p => p.level === level).map(p => p.id)
}

/** Runs `fn` over `items` with at most `limit` in flight. pack-content hits an
 *  authenticated Netlify function backed by blob storage with no batch
 *  endpoint — level 4 alone is 335 packs, so an unbounded Promise.all would
 *  fire 335 concurrent requests. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export interface LevelMasteryProgress {
  loaded: number
  total: number
}

/**
 * Marking a level is one all-or-nothing write over 109–335 pack requests. When
 * one of them fails the declaration cannot honestly proceed — a partial mark
 * would leave the level flagged as known with words that were never touched —
 * so it stops here, and it stops LOUDLY: the whole operation used to reject
 * with whatever the first failed fetch threw, straight past a `try/finally`
 * with no `catch`, which put the UI back exactly where it started and told the
 * user nothing at all.
 */
export class LevelMasteryFetchError extends Error {
  constructor(
    public readonly failed: string[],
    public readonly total: number,
    /** HTTP status shared by the failures, when there is one — 402 (expired
     *  entitlement) and 401 (expired session) are the ones worth naming. */
    public readonly status: number | null,
  ) {
    super(`Level mastery: ${failed.length}/${total} packs failed to load${status ? ` (HTTP ${status})` : ''}`)
    this.name = 'LevelMasteryFetchError'
  }
}

/** Retried only where a retry can help: a network drop, a rate limit, a 5xx.
 *  401 already gets one token-refresh retry inside requestPack; 402/403/404
 *  are settled answers and retrying them just makes the wait longer. */
function worthRetrying(err: unknown): boolean {
  if (err instanceof PackFetchError) return err.status === 429 || err.status >= 500
  return true // a thrown fetch/JSON error — no status, so: transient until proven otherwise
}

const PACK_FETCH_ATTEMPTS = 3

type PackResult = { ok: true; pack: Pack } | { ok: false; error: unknown }

async function fetchPackResilient(id: string): Promise<PackResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return { ok: true, pack: await fetchPack(id) }
    } catch (err) {
      if (attempt >= PACK_FETCH_ATTEMPTS || !worthRetrying(err)) return { ok: false, error: err }
      await new Promise(r => setTimeout(r, 250 * attempt))
    }
  }
}

/**
 * Per-word transition for the level-mastery declaration. Deliberately its own
 * function, not an extension of applyKnown: the semantics are stronger
 * (permanent exclusion from review until manually undone, vs. applyKnown's
 * bulk mode which re-verifies in ~2 weeks) and apply uniformly across an
 * entire level.
 *
 * Two cases:
 *  - The word was already known through REAL study (has a genuine review
 *    history, i.e. it isn't itself already a declaration) — every field that
 *    reflects that history is left untouched; the word is only pulled out of
 *    rotation, and the retirement itself is flagged as forced (not earned),
 *    so it can't farm the retirement point bonus on top of what it already
 *    earned honestly.
 *  - Everything else (never studied, or already known ONLY by an earlier
 *    declaration) — a full "declared known + retired" write.
 */
export function applyLevelMasteryToWord(
  existing: WordProgress | undefined,
  wordId: string,
  packageId: string,
  now: Date = new Date(),
): WordProgress {
  const nowIso = now.toISOString()
  const reallyKnown = existing?.status === 'known' && !isDeclaredKnownWord(existing)

  if (reallyKnown) {
    return {
      ...existing!,
      retiredAt: nowIso,
      nextReviewAt: undefined,
      declaredRetiredAt: existing!.declaredRetiredAt ?? nowIso,
    }
  }

  return {
    wordId,
    packageId,
    seenCount: existing?.seenCount ?? 0,
    lastSeen: existing?.lastSeen ?? nowIso,
    status: 'known',
    reviewCount: existing?.reviewCount,
    lapseCount: existing?.lapseCount,
    lastLapseAt: existing?.lastLapseAt,
    retiredAt: nowIso,
    nextReviewAt: undefined,
    stability: existing?.stability,
    difficulty: existing?.difficulty,
    declaredKnownAt: existing?.declaredKnownAt ?? nowIso,
    declaredRetiredAt: existing?.declaredRetiredAt ?? nowIso,
  }
}

/**
 * Per-pack transition for the declaration. Mastery is a claim about KNOWLEDGE,
 * so it stamps `masteredAt` (and `completedAt`, since a level you declare
 * known is a level you're done working through) and leaves the listen axis
 * exactly as it was.
 *
 * This used to write `currentIndex: pack.words.length`, which is what made a
 * declared level report itself as fully listened: every "odsłuchane" figure in
 * the app reads that field. See services/listenAxis.ts.
 */
export function packageProgressForLevelMastery(
  existing: PackageProgress | undefined,
  packageId: string,
  nowIso: string,
): PackageProgress {
  return {
    packageId,
    startedAt: existing?.startedAt ?? nowIso,
    completedAt: nowIso,
    masteredAt: nowIso,
    listenedAt: existing?.listenedAt ?? null,
    currentIndex: existing?.currentIndex ?? 0,
  }
}

/** Marks every word in `level` as mastered with a full undo snapshot.
 *  `onProgress` drives the "Pobieranie X/N paczek" UI — fetching pack content
 *  for a big level can take real, user-visible time. */
export async function markLevelMastered(
  level: number,
  onProgress?: (p: LevelMasteryProgress) => void,
): Promise<LevelMasterySnapshot> {
  const packageIds = packageIdsForLevel(level)
  const now = new Date()
  const nowIso = now.toISOString()

  let loaded = 0
  const results = await mapWithConcurrency(packageIds, LEVEL_MASTERY_FETCH_CONCURRENCY, async id => {
    const result = await fetchPackResilient(id)
    onProgress?.({ loaded: ++loaded, total: packageIds.length })
    return result
  })

  // Every failure, not just the first: "nie udało się pobrać 1 z 335 paczek"
  // is a fixable problem, "nie udało się pobrać 335 z 335 (błąd 402)" is a
  // different one, and the user can only tell them apart if we count.
  const errors = results.filter((r): r is { ok: false; error: unknown } => !r.ok)
  if (errors.length > 0) {
    const failed = packageIds.filter((_, i) => !results[i].ok)
    const statuses = errors.map(r => (r.error instanceof PackFetchError ? r.error.status : null))
    const shared = statuses.every(s => s === statuses[0]) ? statuses[0] : null
    console.error('[levelMastery] pack fetch failed:', failed.slice(0, 10), errors[0].error)
    throw new LevelMasteryFetchError(failed, packageIds.length, shared)
  }
  const packs = results.map(r => (r as { ok: true; pack: Pack }).pack)

  // Two IndexedDB reads total, not one per pack.
  const [allWords, allPackages] = await Promise.all([getAllWordProgress(), getAllPackageProgress()])
  const wpByWordId = new Map(allWords.map(w => [w.wordId, w]))
  const ppByPackageId = new Map(allPackages.map(p => [p.packageId, p]))

  const wordEntries: LevelMasteryWordEntry[] = []
  const newWords: WordProgress[] = []
  const packageEntries: LevelMasteryPackageEntry[] = []
  const newPackages: PackageProgress[] = []

  for (const pack of packs) {
    for (const word of pack.words) {
      const existing = wpByWordId.get(word.id)
      wordEntries.push({ wordId: word.id, packageId: pack.id, prev: existing ?? null })
      newWords.push(applyLevelMasteryToWord(existing, word.id, pack.id, now))
    }
    const existingPkg = ppByPackageId.get(pack.id)
    packageEntries.push({ packageId: pack.id, prev: existingPkg ?? null })
    newPackages.push(packageProgressForLevelMastery(existingPkg, pack.id, nowIso))
  }

  const snapshot: LevelMasterySnapshot = {
    level, markedAt: nowIso, words: wordEntries, packages: packageEntries,
  }
  await saveLevelMastery(snapshot, newWords, newPackages)
  return snapshot
}

export async function unmarkLevelMastered(level: number): Promise<void> {
  await undoLevelMastery(level)
}

export async function isLevelMastered(level: number): Promise<boolean> {
  return (await getLevelMasterySnapshot(level)) != null
}
