/**
 * Aggregate review maths — pure, no IO. The per-word state machine is review.ts;
 * the numbers are reviewConfig.ts.
 *
 *  - computeReviewBudget  — how many reviews a day is worth showing
 *  - computeServingState  — budget vs. what's already been done today
 *  - scoreDueWord/orderDueWords — which words come first when the serving is capped
 *  - reviewUrgency        — the calm / building / urgent indicator
 *  - staleWordCount       — words genuinely neglected, for freshness/clean metrics
 *  - planInterludes       — the listening breaks spliced into a review run
 */
import { WordProgress, PackageProgress } from '../types/progress'
import { PackMeta } from '../types/vocabulary'
import { dayKey, daysBetween } from '../utils/day'
import { retrievability } from './fsrs'
import {
  REVIEW_LADDER,
  BUDGET_MODE,
  REVIEWS_PER_MINUTE,
  SERVING_MIN,
  SERVING_MAX,
  SERVING_FLEX_DIVISOR,
  SERVING_FLEX_CAP,
  PACE_HEADROOM,
  PACE_FLOOR,
  SERVING_ENABLED,
  PRIORITY,
  STRUGGLE_LAPSES,
  LEECH_LAPSES,
  W_NEGLECT,
  W_DECAY,
  W_CRITICAL,
  W_DEEP_MAINT,
  R_CRITICAL,
  BELOW_LEVEL_GRACE_DAYS,
  STALE_GRACE_DAYS,
  REVIEW_INTERLUDE_EVERY,
  REVIEW_INTERLUDE_SIZE,
  INTERLUDE_KNOWN_SLOTS,
  LISTEN_BELOW_RATIO,
  LISTEN_MAX_PACKS,
} from './reviewConfig'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Days `wp` is overdue on `today` (0 if not yet due / unscheduled). */
function daysLate(wp: WordProgress, today: string): number {
  return Math.max(0, daysBetween(wp.nextReviewAt ?? today, today))
}

/** Recall probability right now, or null if the word has no FSRS state yet. */
export function retrievabilityOf(wp: WordProgress, today: string): number | null {
  if (wp.stability == null || !wp.lastSeen) return null
  const t = Math.max(0, daysBetween(dayKey(new Date(wp.lastSeen)), today))
  return retrievability(t, wp.stability)
}

// ── Budget ─────────────────────────────────────────────────────────────────

/**
 * How many reviews a day is worth showing.
 *  - 'pace': the time goal is a ceiling, the last 7 days' words/day (× headroom)
 *    is the reality check — a 60-min goal with 5 min/day of real study gets a
 *    small budget, not 40.
 *  - 'flex' (legacy): goal-derived + a bump per 1000 known words.
 */
export function computeReviewBudget(opts: { goalSec: number; recentPace?: number; knownTotal?: number }): number {
  const goalDerived = Math.round((opts.goalSec / 60) * REVIEWS_PER_MINUTE)
  if (BUDGET_MODE === 'flex') {
    const flex = Math.min(SERVING_FLEX_CAP, Math.floor((opts.knownTotal ?? 0) / SERVING_FLEX_DIVISOR))
    return clamp(goalDerived + flex, SERVING_MIN, SERVING_MAX)
  }
  const paceDerived = Math.round((opts.recentPace ?? 0) * PACE_HEADROOM)
  return clamp(Math.min(goalDerived, Math.max(paceDerived, PACE_FLOOR)), SERVING_MIN, SERVING_MAX)
}

/**
 * Words reviewed today, derived from wordProgress rather than from `__review__`
 * sessions — so it also counts reviews done "in passing" inside a Trenuj pack,
 * and isn't thrown off by a session abandoned before its end-of-run save.
 * A word counts if it was answered today, has been through ≥1 review cycle
 * (excludes a word first learned today), and is now rescheduled forward.
 */
export function reviewsDoneToday(wordProgress: WordProgress[], today: string = dayKey()): number {
  let n = 0
  for (const w of wordProgress) {
    if (!w.lastSeen || dayKey(new Date(w.lastSeen)) !== today) continue
    if ((w.reviewCount ?? 0) + (w.lapseCount ?? 0) < 1) continue
    if (w.nextReviewAt == null || w.nextReviewAt <= today) continue
    n++
  }
  return n
}

export interface ServingState {
  /** Raw backlog — every due, non-retired word. */
  backlog: number
  budget: number
  served: number
  /** max(0, budget - served) — what's left to show today. */
  remaining: number
  /** Nothing due, or today's budget is spent. */
  done: boolean
}

export function computeServingState(opts: {
  due: WordProgress[]
  wordProgress: WordProgress[]
  goalSec: number
  recentPace?: number
  knownTotal?: number
  today?: string
}): ServingState {
  const backlog = opts.due.length

  // Flag off → the serving is the whole backlog, i.e. exactly today's behaviour.
  if (!SERVING_ENABLED) {
    return { backlog, budget: backlog, served: 0, remaining: backlog, done: backlog === 0 }
  }

  const today = opts.today ?? dayKey()
  const budget = computeReviewBudget({
    goalSec: opts.goalSec,
    recentPace: opts.recentPace,
    knownTotal: opts.knownTotal,
  })
  const served = reviewsDoneToday(opts.wordProgress, today)
  // Never offer more than is actually due, however much budget is left.
  const remaining = Math.min(backlog, Math.max(0, budget - served))
  return { backlog, budget, served, remaining, done: backlog === 0 || remaining === 0 }
}

// ── Priority ordering ──────────────────────────────────────────────────────

export interface PriorityCtx {
  today: string
  todayLevel: number | null
  packLevelOf: (packageId: string) => number
}

function isBelowLevel(wp: WordProgress, ctx: PriorityCtx): boolean {
  return ctx.todayLevel != null && ctx.packLevelOf(wp.packageId) < ctx.todayLevel
}

export function scoreDueWord(wp: WordProgress, ctx: PriorityCtx): number {
  const late = daysLate(wp, ctx.today)
  const r = retrievabilityOf(wp, ctx.today)

  // Core term: how much the memory has decayed. FSRS uses (1 − R); pre-FSRS
  // words fall back to a days-late proxy.
  const decay = r != null ? 1 - r : clamp(late / 20, 0, 1)
  let score = decay * W_DECAY

  // Anti-starvation — both dominate the level / near-graduation penalties.
  if (r != null && r < R_CRITICAL) score += W_CRITICAL
  if (late > STALE_GRACE_DAYS) score += W_NEGLECT

  const s = wp.stability ?? 0
  const rc = wp.reviewCount ?? 0
  if (s > 0 ? s < 7 : rc <= 1) score += PRIORITY.fragileYoung
  else if (s === 0 && rc === 2) score += PRIORITY.fragileMid
  if (s === 0 && rc >= 4) score += PRIORITY.nearGraduation

  if ((wp.lapseCount ?? 0) >= STRUGGLE_LAPSES || (wp.difficulty ?? 0) >= 8) score += PRIORITY.struggle
  if (wp.retiredAt != null) score += W_DEEP_MAINT

  // The level penalty only holds while the word is still safe.
  const stillSafe = r != null ? r > 0.75 : late <= BELOW_LEVEL_GRACE_DAYS
  if (isBelowLevel(wp, ctx) && stillSafe) score += PRIORITY.belowLevel

  return score
}

/** FNV-1a 32-bit — a cheap stable hash for the final tiebreak, so ties don't
 *  systematically favour early packs the way wordId.localeCompare did. */
function hashStr(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Most urgent first. Ties break by longest-overdue, then a hash of wordId. */
export function orderDueWords(due: WordProgress[], ctx: PriorityCtx): WordProgress[] {
  const scored = due.map(wp => ({ wp, score: scoreDueWord(wp, ctx) }))
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const byDate = (a.wp.nextReviewAt ?? '').localeCompare(b.wp.nextReviewAt ?? '')
    if (byDate !== 0) return byDate
    return hashStr(a.wp.wordId) - hashStr(b.wp.wordId)
  })
  return scored.map(s => s.wp)
}

// ── Urgency & neglect ──────────────────────────────────────────────────────

export type ReviewUrgency = 'calm' | 'building' | 'urgent'

export function reviewUrgency(opts: {
  state: ServingState
  due: WordProgress[]
  today?: string
}): ReviewUrgency {
  const today = opts.today ?? dayKey()
  const { backlog, budget } = opts.state

  let maxDaysLate = 0
  let leeches = 0
  let critical = 0 // about to be forgotten (R < R_CRITICAL)
  let weak = 0 // noticeably decayed (R < 0.8)
  for (const wp of opts.due) {
    const late = daysLate(wp, today)
    if (late > maxDaysLate) maxDaysLate = late
    if ((wp.lapseCount ?? 0) >= LEECH_LAPSES) leeches++
    const r = retrievabilityOf(wp, today)
    if (r != null && r < R_CRITICAL) critical++
    if (r != null && r < 0.8) weak++
  }

  if (critical > 0 || backlog > 3 * budget || maxDaysLate > STALE_GRACE_DAYS || leeches > 0) return 'urgent'
  if (weak === 0 && backlog <= budget && maxDaysLate <= 3 && leeches === 0) return 'calm'
  return 'building'
}

/**
 * Words genuinely neglected — decayed AND overdue past the grace window. Feeds
 * freshnessPct and, via snapshot.staleCount, the clean-streak. Below-level words
 * are forgiven only while still safe (R > 0.8, or within 2× the grace window
 * pre-FSRS) — beyond that they count like any other neglected word.
 */
export function staleWordCount(due: WordProgress[], ctx: PriorityCtx): number {
  let n = 0
  for (const wp of due) {
    const late = daysLate(wp, ctx.today)
    if (late <= STALE_GRACE_DAYS) continue
    const r = retrievabilityOf(wp, ctx.today)
    if (r != null && r >= 0.8) continue // scheduled long, not actually decayed yet
    // Below-level words are forgiven only while still safe — R-based under FSRS,
    // else within 2× the grace window.
    if (isBelowLevel(wp, ctx) && r == null && late <= STALE_GRACE_DAYS * 2) continue
    n++
  }
  return n
}

// ── Retention breakdown (memory-strength distribution) ─────────────────────

/** fresh → setting → solid → strong → locked, by growing memory strength. */
export type RetentionTier = 'fresh' | 'setting' | 'solid' | 'strong' | 'locked'

/** Lower bound (days of stability) for each tier. `locked` is also anything with
 *  retiredAt set. */
export const RETENTION_TIER_MIN: Record<RetentionTier, number> = {
  fresh: 0,
  setting: 7,
  solid: 21,
  strong: 60,
  locked: 365,
}

export const RETENTION_TIERS: RetentionTier[] = ['fresh', 'setting', 'solid', 'strong', 'locked']

/** A known word's memory strength in days: its FSRS `stability`, or — for a word
 *  not yet reviewed under FSRS — the interval its ladder `reviewCount` maps to. */
export function effectiveStability(wp: WordProgress): number {
  if (wp.stability != null) return wp.stability
  return REVIEW_LADDER[Math.min(wp.reviewCount ?? 0, REVIEW_LADDER.length - 1)]
}

export function retentionTierOf(wp: WordProgress): RetentionTier {
  if (wp.retiredAt != null) return 'locked'
  const s = effectiveStability(wp)
  if (s >= RETENTION_TIER_MIN.locked) return 'locked'
  if (s >= RETENTION_TIER_MIN.strong) return 'strong'
  if (s >= RETENTION_TIER_MIN.solid) return 'solid'
  if (s >= RETENTION_TIER_MIN.setting) return 'setting'
  return 'fresh'
}

export interface RetentionBreakdown {
  buckets: { tier: RetentionTier; count: number }[]
  /** Total 'known' words. */
  total: number
  /** Share (0–100) that is 'strong' or 'locked' — holds for months+. */
  durablePct: number
}

/** Distribution of the user's `known` vocabulary across retention tiers. */
export function retentionBreakdown(wordProgress: WordProgress[]): RetentionBreakdown {
  const counts: Record<RetentionTier, number> = {
    fresh: 0, setting: 0, solid: 0, strong: 0, locked: 0,
  }
  let total = 0
  for (const wp of wordProgress) {
    if (wp.status !== 'known') continue
    counts[retentionTierOf(wp)]++
    total++
  }
  const durable = counts.strong + counts.locked
  return {
    buckets: RETENTION_TIERS.map(tier => ({ tier, count: counts[tier] })),
    total,
    durablePct: total > 0 ? Math.round((durable / total) * 100) : 0,
  }
}

// ── Listening interludes ───────────────────────────────────────────────────

export interface PackRatio {
  packId: string
  known: number
  total: number
  ratio: number
}

/** Started packs the user has mastered in less than `ratio` — the material to
 *  reinforce passively. Sorted least-known first. */
export function packsBelowKnownRatio(
  packs: PackMeta[],
  knownMap: Map<string, number>,
  progressMap: Map<string, PackageProgress>,
  ratio: number = LISTEN_BELOW_RATIO
): PackRatio[] {
  const out: PackRatio[] = []
  for (const p of packs) {
    if (p.wordCount <= 0 || !progressMap.has(p.id)) continue
    const known = knownMap.get(p.id) ?? 0
    const r = known / p.wordCount
    if (r < ratio) out.push({ packId: p.id, known, total: p.wordCount, ratio: r })
  }
  return out.sort((a, b) => a.ratio - b.ratio)
}

export interface InterludePlan {
  /** Packs whose content the caller must fetch to draw the "main" interlude words. */
  packIds: string[]
  /** Already-known / retired wordIds to sprinkle in for reinforcement. */
  reinforcementWordIds: string[]
  /** Words per interlude. */
  perInterlude: number
  /** How many interludes to splice into the run. */
  count: number
}

/**
 * Plans the listening breaks for a review run of `cardCount` flashcards. Passive
 * only — the caller never writes WordProgress for these.
 */
export function planInterludes(args: {
  wordProgress: WordProgress[]
  progressMap: Map<string, PackageProgress>
  packs: PackMeta[]
  knownMap: Map<string, number>
  cardCount: number
  rng?: () => number
}): InterludePlan {
  const rng = args.rng ?? Math.random
  const count = Math.floor(args.cardCount / REVIEW_INTERLUDE_EVERY)
  if (count <= 0) {
    return { packIds: [], reinforcementWordIds: [], perInterlude: REVIEW_INTERLUDE_SIZE, count: 0 }
  }

  const totalWords = count * REVIEW_INTERLUDE_SIZE
  const wantReinforcement = Math.min(totalWords, count * INTERLUDE_KNOWN_SLOTS)

  // Reinforcement pool: retired first (we no longer test these at all), then plain known.
  const retired = args.wordProgress.filter(w => w.retiredAt != null)
  const known = args.wordProgress.filter(w => w.retiredAt == null && w.status === 'known')
  const reinforcementWordIds = [...shuffle(retired, rng), ...shuffle(known, rng)]
    .slice(0, wantReinforcement)
    .map(w => w.wordId)

  const belowRatio = packsBelowKnownRatio(args.packs, args.knownMap, args.progressMap)
  const packIds = belowRatio.slice(0, LISTEN_MAX_PACKS).map(p => p.packId)

  // Nothing mid-learning and nothing known → no interludes, run is pure flashcards.
  if (packIds.length === 0 && reinforcementWordIds.length === 0) {
    return { packIds: [], reinforcementWordIds: [], perInterlude: REVIEW_INTERLUDE_SIZE, count: 0 }
  }

  return { packIds, reinforcementWordIds, perInterlude: REVIEW_INTERLUDE_SIZE, count }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
