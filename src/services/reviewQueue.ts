/**
 * Aggregate review maths — pure, no IO. The per-word state machine is review.ts;
 * the numbers are reviewConfig.ts.
 *
 *  - activeDayMinutes     — how long the learner actually studies, per study day
 *  - reviewSecPerCard     — how long ONE review card takes them, measured
 *  - computeReviewBudget  — how many reviews a day is worth showing
 *  - computeServingState  — budget vs. what's already been done today
 *  - maintenanceLoad      — how many reviews the learner's own material generates
 *  - scoreDueWord/orderDueWords — which words come first when the serving is capped
 *  - reviewUrgency        — the calm / building / urgent indicator
 *  - staleWordCount       — words genuinely neglected, for freshness/clean metrics
 *  - planInterludes       — the listening breaks spliced into a review run
 */
import { WordProgress, PackageProgress, DailyTime, Session } from '../types/progress'
import { PackMeta } from '../types/vocabulary'
import { dayKey, daysBetween, shiftDay } from '../utils/day'
import { retrievability } from './fsrs'
import { isDeclaredRetiredWord } from './review'
import {
  REVIEW_LADDER,
  REVIEW_SEC_PER_CARD,
  REVIEW_PACE,
  SERVING_MIN,
  SERVING_DAY_MAX,
  PACE_FLOOR,
  DEBT_HORIZON_DAYS,
  DEBT_FLOOR_ENABLED,
  ACTIVE_WINDOW_DAYS,
  ACTIVE_DAY_MIN_SEC,
  ACTIVE_FALLBACK_DAYS,
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
 * Average length of a STUDY day, in minutes, over the last ACTIVE_WINDOW_DAYS —
 * or null when there isn't a single qualifying day to average.
 *
 * Read from the dailyTime ledger rather than from session rows on purpose. The
 * ledger ticks every 30 s while studying and survives an abandoned session, and
 * — the point — nothing caps it. `wordsCompleted` on a review session is the
 * budget that was granted, so a budget derived from it is a budget derived from
 * itself. Seconds studied are the one quantity in the system the budget cannot
 * manufacture.
 *
 * Days below ACTIVE_DAY_MIN_SEC are dropped rather than counted as zero: the
 * question this answers is "how long do they sit down for", not "how often".
 * How often is already priced in by `debtFloor` — skip days and the backlog
 * grows, which raises the floor on its own.
 *
 * Null is reserved for a learner with NO study history whatsoever, because the
 * budget reads null as "trust the goal they just chose" and hands over the
 * whole of it. Someone returning after a break has history — just none inside
 * the window — and greeting them with the largest serving the app can produce
 * is the same mistake as starving them, pointed the other way. For them the
 * most recent ACTIVE_FALLBACK_DAYS study days stand in, however old.
 */
export function activeDayMinutes(dailyTime: DailyTime[], today: string = dayKey()): number | null {
  const from = shiftDay(-(ACTIVE_WINDOW_DAYS - 1), today)
  const studyDays = dailyTime.filter(d => d.date <= today && d.secondsStudied >= ACTIVE_DAY_MIN_SEC)

  const inWindow = studyDays.filter(d => d.date >= from)
  const sample = inWindow.length > 0
    ? inWindow
    : [...studyDays].sort((a, b) => b.date.localeCompare(a.date)).slice(0, ACTIVE_FALLBACK_DAYS)

  if (sample.length === 0) return null
  return sample.reduce((sum, d) => sum + d.secondsStudied, 0) / sample.length / 60
}

/**
 * How many reviews a day is worth showing.
 *
 *   budget = min(goalDerived, max(timeDerived, debtFloor, PACE_FLOOR))
 *
 * The goal is the ceiling — the serving never promises more than the day the
 * learner signed up for can hold. Measured study time is the reality check, so
 * a 60-minute goal backed by 10-minute sittings gets a 10-minute serving. And
 * the backlog is a floor: arrears spread over DEBT_HORIZON_DAYS, capped by the
 * ceiling like everything else. Without that last term the learner furthest
 * behind got the smallest serving, which is the wrong way round — see the note
 * in reviewConfig.ts.
 *
 * `activeMinutes: null` means *no evidence yet* and is not the same as a
 * measured zero. Conflating the two is what made a brand-new account's budget
 * collapse to the floor however ambitious the goal it had just set, so Dzisiaj
 * could announce "Porcja na dziś zrobiona" after eight words on day one. With
 * no evidence, the goal the learner chose is the best estimate there is.
 */
export function computeReviewBudget(opts: {
  goalSec: number
  /** Minutes per study day (activeDayMinutes). null = no evidence yet. */
  activeMinutes?: number | null
  /** Words currently due. Omitted = no debt term. */
  backlog?: number
  /** Seconds one review card takes this learner (reviewSecPerCard). Omitted =
   *  the cold-start pace. Both terms below are minutes → cards, so this is what
   *  decides whether a goal's worth of time is 12 reviews or 60. */
  secPerCard?: number
}): number {
  const perMinute = 60 / (opts.secPerCard ?? REVIEW_SEC_PER_CARD)
  const goalDerived = Math.round((opts.goalSec / 60) * perMinute)
  const ceiling = Math.min(goalDerived, SERVING_DAY_MAX)

  const timeDerived = opts.activeMinutes == null
    ? goalDerived
    : Math.round(opts.activeMinutes * perMinute)
  const debtFloor = DEBT_FLOOR_ENABLED
    ? Math.min(ceiling, Math.ceil(Math.max(0, opts.backlog ?? 0) / DEBT_HORIZON_DAYS))
    : 0

  const want = Math.max(timeDerived, debtFloor, PACE_FLOOR)
  // The floor is itself capped by the ceiling, so a goal smaller than
  // SERVING_MIN still wins — the clamp can never push past the day's goal.
  return clamp(want, Math.min(SERVING_MIN, ceiling), ceiling)
}

/**
 * Minutes a run of `count` reviews actually takes — the same pace the budget is
 * sized with, so the number on screen and the number of cards behind it can
 * never drift apart again.
 *
 * `secPerCard` comes from `reviewSecPerCard`; the default is the cold start.
 * The figure this replaced was a flat 50 s a card, which called 88 due words
 * "ok. 73 min" — a queue the learner could actually clear in about twelve.
 */
export function reviewMinutes(count: number, secPerCard: number = REVIEW_SEC_PER_CARD): number {
  return Math.max(1, Math.round((count * secPerCard) / 60))
}

/**
 * Seconds one review card takes THIS learner, measured from their own review
 * sessions — or REVIEW_SEC_PER_CARD while there isn't enough evidence.
 *
 * Only `trainMode: 'review'` sessions count. A Trenuj or Inteligentny card is a
 * different job (new words, typed answers, sentences) and runs at a different
 * speed, and mixing them is how an estimate ends up describing nobody.
 * Interludes are deliberately left in the numerator: they are part of the run's
 * wall-clock, so a learner who keeps them sees a pace that includes them.
 *
 * Nothing here can loop back on itself. `wordsCompleted` on a review session is
 * the budget that was granted, and `durationSec` is real time — their RATIO is
 * the one quantity the budget cannot manufacture, which is exactly why the
 * pace, not the card count, is what the budget reads. (It only works because
 * each batch now records its OWN duration; see ReviewPage.finishBatch.)
 */
export function reviewSecPerCard(sessions: Session[], today: string = dayKey()): number {
  const from = shiftDay(-(REVIEW_PACE.WINDOW_DAYS - 1), today)
  let cards = 0
  let seconds = 0
  for (const s of sessions) {
    if (s.trainMode !== 'review') continue
    if (s.date < from || s.date > today) continue
    const dur = s.durationSec ?? 0
    if (s.wordsCompleted < REVIEW_PACE.MIN_SESSION_CARDS || dur < REVIEW_PACE.MIN_SESSION_SEC) continue
    cards += s.wordsCompleted
    seconds += dur
  }
  if (cards < REVIEW_PACE.MIN_CARDS || seconds <= 0) return REVIEW_SEC_PER_CARD
  return clamp(seconds / cards, REVIEW_PACE.MIN_SEC, REVIEW_PACE.MAX_SEC)
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
  /** Minutes per study day; null = no study-time history yet. See computeReviewBudget. */
  activeMinutes?: number | null
  /** Measured seconds per review card; omitted = the cold-start pace. */
  secPerCard?: number
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
    activeMinutes: opts.activeMinutes,
    backlog,
    secPerCard: opts.secPerCard,
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
  /** Known words the tiers actually describe — everything the app has measured
   *  a memory strength for and still has a date for. */
  total: number
  /** Share (0–100) that is 'strong' or 'locked' — holds for months+. */
  durablePct: number
  /** Known words a declaration pulled out of review for good ("oznacz poziom
   *  jako opanowany"). Knowledge the learner brought from outside the app: it
   *  has no measured stability and no next date, so binning it by memory
   *  strength and printing a cadence beside it would be two fictions. Counted
   *  and named separately instead. */
  declared: number
}

/**
 * Distribution of the user's `known` vocabulary across retention tiers.
 *
 * Declared-retired words are split off rather than binned. They used to land in
 * `locked` — which on an account that had declared a level or two meant 98% of
 * the chart sat in one segment, under a cadence ("raz w roku") that nothing in
 * the scheduler was ever going to honour, over a summary crediting it to
 * "powtórki robione w coraz dłuższych odstępach" that had never happened. The
 * rest of the app already draws this line (points.ts, the learning rate, the
 * Statystyki note); this is the one place that didn't.
 */
export function retentionBreakdown(wordProgress: WordProgress[]): RetentionBreakdown {
  const counts: Record<RetentionTier, number> = {
    fresh: 0, setting: 0, solid: 0, strong: 0, locked: 0,
  }
  let total = 0
  let declared = 0
  for (const wp of wordProgress) {
    if (wp.status !== 'known') continue
    if (isDeclaredRetiredWord(wp)) {
      declared++
      continue
    }
    counts[retentionTierOf(wp)]++
    total++
  }
  const durable = counts.strong + counts.locked
  return {
    buckets: RETENTION_TIERS.map(tier => ({ tier, count: counts[tier] })),
    total,
    durablePct: total > 0 ? Math.round((durable / total) * 100) : 0,
    declared,
  }
}

// ── Maintenance load ───────────────────────────────────────────────────────

export interface MaintenanceLoad {
  /** Reviews per day the learner's own vocabulary generates at steady state. */
  perDay: number
  /** …in minutes, at the learner's own review pace. */
  minutesPerDay: number
  /** Share (0–100) of that load today's budget covers. 0 budget → 0. */
  coveredPct: number
}

/**
 * How many reviews a day the learner's material generates once the schedule
 * settles — the inflow the daily serving is trying to keep up with.
 *
 * Nothing in the system computed this before, which is why a backlog could be
 * read as "arrears to catch up on" when it was in fact the equilibrium the
 * schedule was converging to. A serving that covers half the inflow does not
 * drain a queue however it is tuned; only longer intervals (a lower desired
 * retention) or fewer new words change that, and neither is a budget decision.
 *
 * Σ(1/stability) is exact rather than heuristic under FSRS: `FACTOR = 19/81` is
 * chosen so `nextInterval(S) === S` at REQUEST_RETENTION 0.9 (see fsrs.ts), so
 * a word of stability S comes back every ~S days and contributes 1/S reviews
 * per day. Retired words are excluded — they keep a real nextReviewAt, but at
 * a yearly cadence their contribution rounds away and they are deliberately not
 * part of the daily grind.
 */
export function maintenanceLoad(
  wordProgress: WordProgress[],
  budget = 0,
  secPerCard: number = REVIEW_SEC_PER_CARD,
): MaintenanceLoad {
  let perDay = 0
  for (const wp of wordProgress) {
    if (wp.status !== 'known' || wp.retiredAt != null) continue
    const s = effectiveStability(wp)
    if (s > 0) perDay += 1 / s
  }
  return {
    perDay: Math.round(perDay),
    // reviewMinutes' floor of 1 applies — "~0 min to keep this up" reads as a
    // broken number — but only once there is a load at all.
    minutesPerDay: perDay > 0 ? reviewMinutes(perDay, secPerCard) : 0,
    coveredPct: perDay > 0 ? Math.min(100, Math.round((budget / perDay) * 100)) : 0,
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
