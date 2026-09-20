import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import {
  WordProgress, PackageProgress, LevelMasterySnapshot,
  LevelMasteryWordEntry, LevelMasteryPackageEntry,
} from '../types/progress'
import { fetchPack } from '../hooks/usePackageData'
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
  const packs = await mapWithConcurrency(packageIds, LEVEL_MASTERY_FETCH_CONCURRENCY, async id => {
    const pack = await fetchPack(id)
    onProgress?.({ loaded: ++loaded, total: packageIds.length })
    return pack
  })

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
    newPackages.push({
      packageId: pack.id,
      startedAt: existingPkg?.startedAt ?? nowIso,
      completedAt: nowIso,
      masteredAt: nowIso,
      currentIndex: pack.words.length,
    })
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
