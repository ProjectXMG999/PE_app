import type { ProgressSnapshot } from '../hooks/useProgressData'
import { orderDueWords, PriorityCtx } from './reviewQueue'
import { estimateMinutes } from '../data/nextPack'
import { dayKey } from '../utils/day'
import { WordProgress } from '../types/progress'
import { Pack, PackMeta, Word } from '../types/vocabulary'
import packagesIndex from '../data/packages-index.json'

/**
 * The Inteligentny mode's queue: one mixed session built from three streams —
 *  - `learn`   new / not-yet-known words from the next packs on the route
 *  - `review`  words the FSRS schedule says are slipping (+ stray leftovers)
 *  - `stretch` words from a harder pack, only when comfort says the learner is
 *              ready for them
 * woven together with animated info cards that explain each hand-off.
 *
 * Selection (sync, no network) is `selectSmart`; the hook then fetches pack
 * content and calls `composeSmartSteps` to turn the selection into a step list.
 * `smartPeek` is the cheap version for the "here's today's mix" start card.
 */

export const SMART = {
  /** Cards per minute of daily goal — the session scales to how much the
   *  learner already commits to, same idea as the review budget. */
  CARDS_PER_MIN: 2.2,
  MIN_CARDS: 12,
  MAX_CARDS: 28,
  /** Share of the session spent on review / stretch; the rest is learn. */
  REVIEW_RATIO: 0.35,
  STRETCH_RATIO: 0.2,
  /** A started pack with this many or fewer words left is a "leftover" pack —
   *  it's pulled from the learn stream (no more 2-card grind) and its stragglers
   *  join the review stream instead. */
  STRAGGLER_MAX: 2,
  /** Ceiling on distinct packs whose content the session will fetch. */
  MAX_PACKS: 8,
  /** Learn cards shown before the first hand-off, so the session opens on
   *  familiar ground. */
  WARMUP_LEARN: 4,
} as const

const allPacks = packagesIndex as PackMeta[]
const PACK_LEVEL = new Map<string, number>(allPacks.map(p => [p.id, p.level]))
const packLevelOf = (id: string): number => PACK_LEVEL.get(id) ?? 1

export type SmartSegment = 'learn' | 'review' | 'stretch'

export type SmartStep =
  | { kind: 'card'; segment: SmartSegment; word: Word; packageId: string; progress?: WordProgress }
  | { kind: 'info'; variant: 'review-ahead' | 'stretch-ahead' | 'back-to-new'; count?: number }

export interface SmartSelection {
  targetCount: number
  quota: Record<SmartSegment, number>
  /** Curriculum-order packs to draw `learn` words from. */
  learnPackIds: string[]
  /** Pack to draw `stretch` words from, or null when comfort isn't there yet. */
  stretchPackId: string | null
  /** Priority-ordered review words (real due words + leftovers), pre-capped. */
  reviewWords: WordProgress[]
  /** Every pack id the session needs content for. */
  packIds: string[]
}

function clampCards(raw: number): number {
  return Math.min(SMART.MAX_CARDS, Math.max(SMART.MIN_CARDS, raw))
}

export function smartTargetCount(goalSec: number): number {
  return clampCards(Math.round((goalSec / 60) * SMART.CARDS_PER_MIN))
}

interface SelectArgs {
  snapshot: ProgressSnapshot
  comfortLevel: number
  todayLevel: number | null
  goalSec: number
}

export function selectSmart({ snapshot, comfortLevel, todayLevel, goalSec }: SelectArgs): SmartSelection {
  const targetCount = smartTargetCount(goalSec)
  const floor = todayLevel ?? 1
  const scoped = allPacks.filter(p => p.level >= floor)

  const knownOf = (id: string) => snapshot.knownMap.get(id) ?? 0
  const isStarted = (id: string) => snapshot.progressMap.has(id)
  const unknownEstimate = (p: PackMeta) => p.wordCount - knownOf(p.id)
  const isStraggler = (p: PackMeta) => {
    const left = unknownEstimate(p)
    return isStarted(p.id) && left >= 1 && left <= SMART.STRAGGLER_MAX
  }
  const isFullyKnown = (p: PackMeta) => knownOf(p.id) >= p.wordCount

  // ── review stream ────────────────────────────────────────────────────────
  const ctx: PriorityCtx = { today: dayKey(), todayLevel, packLevelOf }
  const orderedDue = orderDueWords(snapshot.dueWords, ctx)

  const stragglerPackIds = new Set(scoped.filter(isStraggler).map(p => p.id))
  const seen = new Set(orderedDue.map(w => w.wordId))
  const stragglerWords = snapshot.wordProgress.filter(
    wp => stragglerPackIds.has(wp.packageId) && wp.status !== 'known' && !seen.has(wp.wordId)
  )

  const reviewTarget = Math.round(targetCount * SMART.REVIEW_RATIO)
  // Real due words are gated by today's serving budget; leftovers are a
  // finish-the-job concern and ignore it (but the whole review slice still
  // can't take over the session).
  const dueCap = snapshot.servingLeft === 0 ? 0 : Math.min(reviewTarget, snapshot.servingLeft)
  const reviewWords = [
    ...orderedDue.slice(0, dueCap),
    ...stragglerWords,
  ].slice(0, Math.max(reviewTarget, Math.ceil(targetCount * 0.5)))

  // ── stretch stream ───────────────────────────────────────────────────────
  const learnCandidates = scoped.filter(p => !isFullyKnown(p) && !isStraggler(p))
  const learnPackLevel = learnCandidates[0]?.level ?? floor
  const targetLevel = Math.min(4, Math.round(comfortLevel))
  let stretchPackId: string | null = null
  let stretchTarget = 0
  if (comfortLevel >= learnPackLevel + 0.6 && targetLevel > learnPackLevel) {
    const stretchPack = allPacks.find(
      p => p.level === targetLevel && !isFullyKnown(p) && !isStraggler(p)
    )
    if (stretchPack) {
      stretchPackId = stretchPack.id
      stretchTarget = Math.round(targetCount * SMART.STRETCH_RATIO)
    }
  }

  // ── learn stream (fills the remainder) ───────────────────────────────────
  const learnTarget = Math.max(0, targetCount - reviewWords.length - stretchTarget)
  const learnPackIds: string[] = []
  let acc = 0
  for (const p of learnCandidates) {
    if (p.id === stretchPackId) continue
    if (acc >= learnTarget || learnPackIds.length >= SMART.MAX_PACKS) break
    learnPackIds.push(p.id)
    acc += unknownEstimate(p)
  }

  const packIds = [
    ...new Set([
      ...learnPackIds,
      ...(stretchPackId ? [stretchPackId] : []),
      ...reviewWords.map(w => w.packageId),
    ]),
  ]

  return {
    targetCount,
    quota: { learn: learnTarget, review: reviewWords.length, stretch: stretchTarget },
    learnPackIds,
    stretchPackId,
    reviewWords,
    packIds,
  }
}

/** Cheap composition summary for the "today's mix" start card — no fetch. */
export function smartPeek(args: SelectArgs): {
  learn: number
  review: number
  stretch: number
  minutes: number
} {
  const sel = selectSmart(args)
  const total = sel.quota.learn + sel.quota.review + sel.quota.stretch
  return {
    learn: sel.quota.learn,
    review: sel.quota.review,
    stretch: sel.stretchPackId ? sel.quota.stretch : 0,
    // Card count here was sized from the goal using SMART.CARDS_PER_MIN (a
    // mixed learn/review/stretch session runs slower than a plain flashcard
    // flip) — estimateMinutes' *default* pace is a much faster 8s/word, meant
    // for browsing a plain pack. Reusing that default here undersold a
    // goal-sized session by ~3x (a 15-min goal peeking as "~4 min"). Pass the
    // same pace it was sized with so the two numbers agree.
    minutes: estimateMinutes(total || sel.targetCount, SMART.CARDS_PER_MIN),
  }
}

interface ComposeArgs {
  selection: SmartSelection
  /** Fetched pack content, keyed by pack id (nulls dropped by the caller). */
  packs: Map<string, Pack>
  wordProgressById: Map<string, WordProgress>
}

export function composeSmartSteps({ selection, packs, wordProgressById }: ComposeArgs): {
  steps: SmartStep[]
  counts: Record<SmartSegment, number>
  packCount: number
} {
  const usedPacks = new Set<string>()

  const takeFromPacks = (
    packIds: string[],
    segment: SmartSegment,
    limit: number
  ): Extract<SmartStep, { kind: 'card' }>[] => {
    const out: Extract<SmartStep, { kind: 'card' }>[] = []
    for (const id of packIds) {
      const pack = packs.get(id)
      if (!pack || out.length >= limit) continue
      for (const word of pack.words) {
        if (out.length >= limit) break
        const progress = wordProgressById.get(word.id)
        if (progress?.status === 'known') continue
        usedPacks.add(id)
        out.push({ kind: 'card', segment, word, packageId: id, progress })
      }
    }
    return out
  }

  const learnCards = takeFromPacks(selection.learnPackIds, 'learn', selection.quota.learn)
  const stretchCards = selection.stretchPackId
    ? takeFromPacks([selection.stretchPackId], 'stretch', selection.quota.stretch)
    : []

  const reviewCards: Extract<SmartStep, { kind: 'card' }>[] = []
  for (const wp of selection.reviewWords) {
    const pack = packs.get(wp.packageId)
    const word = pack?.words.find(w => w.id === wp.wordId)
    if (!word) continue
    usedPacks.add(wp.packageId)
    reviewCards.push({ kind: 'card', segment: 'review', word, packageId: wp.packageId, progress: wp })
  }

  const warmup = learnCards.slice(0, SMART.WARMUP_LEARN)
  const restLearn = learnCards.slice(SMART.WARMUP_LEARN)

  const steps: SmartStep[] = [...warmup]
  if (reviewCards.length) {
    steps.push({ kind: 'info', variant: 'review-ahead', count: reviewCards.length })
    steps.push(...reviewCards)
  }
  if (stretchCards.length) {
    steps.push({ kind: 'info', variant: 'stretch-ahead', count: stretchCards.length })
    steps.push(...stretchCards)
  }
  if (restLearn.length) {
    if (reviewCards.length || stretchCards.length) {
      steps.push({ kind: 'info', variant: 'back-to-new' })
    }
    steps.push(...restLearn)
  }

  return {
    steps,
    counts: {
      learn: learnCards.length,
      review: reviewCards.length,
      stretch: stretchCards.length,
    },
    packCount: usedPacks.size,
  }
}
