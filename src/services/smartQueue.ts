import type { ProgressSnapshot } from '../hooks/useProgressData'
import { orderDueWords, PriorityCtx } from './reviewQueue'
import {
  ReviewHealth, EMPTY_REVIEW_HEALTH, reviewRatioFor, allowStretch, healthTone, HealthTone,
} from './reviewHealth'
import { estimateMinutes } from '../data/nextPack'
import { dayKey, shiftDay } from '../utils/day'
import { Session, WordProgress } from '../types/progress'
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
 *
 * The learn/review split is not fixed: `reviewHealth` (services/reviewHealth.ts)
 * measures how scheduled reviews are actually going and moves REVIEW_RATIO
 * against it — a learner whose old words are holding gets more new material, one
 * whose words are slipping gets more maintenance, and below STRETCH_FLOOR the
 * stretch stream is dropped entirely.
 */

export const SMART = {
  /** Cold-start pace, in cards per minute, used to turn goal-minutes into a
   *  number of cards. It used to sit at 2.2 (27 s/card), a figure nothing
   *  measured; combined with a whole-goal session it made a 60-minute goal
   *  promise 132 cards, i.e. ~90 real minutes in one sitting.
   *  `measuredCardsPerMin` replaces it with the learner's own pace the moment
   *  there's enough history to read one.
   *
   *  1.4 was then set to sit near /powtorka's REVIEWS_PER_MINUTE of 1.2 — a
   *  figure since found to be five times too slow (see the pace note in
   *  reviewConfig.ts) and replaced there by a measured seconds-per-card. That
   *  makes this cold start, and PACE.MAX below, almost certainly too slow as
   *  well: a Smart card carries new words and typed answers, so it is genuinely
   *  heavier than a review flip, but not 43 seconds' worth. Left alone pending
   *  the same measurement treatment — a deliberate to-do, not a justification. */
  CARDS_PER_MIN: 1.4,
  MIN_CARDS: 12,
  /** Ceiling on ONE SITTING, not on the day. The daily goal is spread over
   *  however many sittings the learner wants: `smartSessionSize` re-measures
   *  what's left of the goal every time the mode is opened, so leaving after 14
   *  cards and coming back offers the rest of the day rather than another
   *  full-size session. /powtorka makes the same "how much is one sitting"
   *  judgement in REVIEW_MAX_WORDS (hooks/useReviewSet.ts) — lower, at 20,
   *  because every card there is a review, where this mode also carries new
   *  words and reads as lighter going. */
  MAX_CARDS: 40,
  /** Baseline share of the session spent on review — the value used before any
   *  review evidence exists, and the one `reviewRatioFor` moves away from. */
  REVIEW_RATIO: 0.35,
  /** Share of the session spent on stretch; the rest is learn. */
  STRETCH_RATIO: 0.2,
  /** A started pack with this many or fewer words left is a "leftover" pack —
   *  it's pulled from the learn stream (no more 2-card grind) and its stragglers
   *  join the review stream instead. */
  STRAGGLER_MAX: 2,
  /** How many straggler words, beyond reviewTarget, may still ride along
   *  purely to close out a leftover pack. Replaces a flat "up to ~50% of the
   *  session" allowance that let the actual review share silently diverge
   *  from reviewRatio — and from what the start card told the learner —
   *  whenever enough leftover packs piled up.
   *  Recalibrated from 6 when MAX_CARDS became a per-sitting 40: six extra
   *  cards were ~5% of a 132-card session but 15% of a sitting, which pushed a
   *  baseline-ratio session back to the ~50% review share this constant exists
   *  to prevent. */
  STRAGGLER_OVERFLOW: 3,
  /** Ceiling on distinct packs whose content the session will fetch.
   *  `selectSmart` raises this dynamically when the packs on offer run smaller,
   *  so a floor that starts mid-catalog on 5-word packs can still reach the
   *  session's learn quota. Since MAX_CARDS became a per-sitting number this
   *  rarely binds — the learn loop stops as soon as it has enough words, which
   *  is 2-4 packs at a typical sitting, not 14. */
  MAX_PACKS: 14,
  /** Absolute ceiling on the dynamic pack cap above, regardless of how small
   *  the candidate packs are — bounds parallel /pack-content fetches even
   *  against a corrupted or unexpectedly fine-grained catalog. Not expected to
   *  bind against today's data: a sitting's learn quota tops out near 18 words
   *  and the smallest pack holds 5, so ~4 packs is the real worst case. */
  MAX_PACKS_HARD_CEILING: 20,
  /** Learn cards shown before the first hand-off, so the session opens on
   *  familiar ground. */
  WARMUP_LEARN: 4,
  /** Spare learn words to line up beyond the learn quota, in words.
   *
   *  The learn loop used to stop at the exact quota, which made the session as
   *  fragile as its least reliable pack: one /pack-content request failing (or
   *  one pack whose words all turn out already known) left the run with no way
   *  to make up the difference, because nothing else had been fetched. Roughly
   *  one extra pack of slack, which `composeSmartSteps` draws on when the
   *  review or stretch streams come up short. */
  LEARN_RESERVE: 8,
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
  /** How `targetCount` was arrived at — pace, daily allowance, what's left. */
  size: SessionSize
  quota: Record<SmartSegment, number>
  /** The review share this session was built with — SMART.REVIEW_RATIO unless
   *  review health moved it. Surfaced so the start card can explain itself. */
  reviewRatio: number
  /** Coarse reading of review health, or null when there isn't enough evidence. */
  tone: HealthTone | null
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

/** How the learner's own pace is read out of their session history. */
export const PACE = {
  /** Only recent sessions — pace changes as material gets harder. */
  WINDOW_DAYS: 14,
  /** Below this much evidence the cold-start constant is the better guess. */
  MIN_SESSIONS: 3,
  MIN_CARDS: 40,
  /** A single session has to be this substantial to be timed honestly — a
   *  3-card stub with a 4-minute clock is a phone put down, not a pace. */
  MIN_SESSION_CARDS: 5,
  MIN_SESSION_SEC: 60,
  /** Bounds on the result: anything outside is a clock artefact (a tab left
   *  open, a session resumed hours later), not a person answering cards. */
  MIN: 0.8,
  MAX: 3.5,
} as const

/**
 * The learner's actual cards-per-minute, or null while there isn't enough
 * evidence to prefer it over SMART.CARDS_PER_MIN.
 *
 * Every rated session already records `durationSec` and `ratedCount`, so this
 * is measured, not assumed — which is the whole point: a session sized from a
 * hardcoded pace, and then *described* to the learner with that same hardcoded
 * pace (`smartPeek` → `estimateMinutes`), can never be caught being wrong.
 */
export function measuredCardsPerMin(sessions: Session[], today: string = dayKey()): number | null {
  const from = shiftDay(-(PACE.WINDOW_DAYS - 1), today)
  let cards = 0
  let seconds = 0
  let counted = 0
  for (const s of sessions) {
    if (s.date < from || s.date > today) continue
    if (s.mode !== 'fiszki') continue // autoplay rates nothing; its clock means something else
    const rated = s.ratedCount ?? 0
    const dur = s.durationSec ?? 0
    if (rated < PACE.MIN_SESSION_CARDS || dur < PACE.MIN_SESSION_SEC) continue
    cards += rated
    seconds += dur
    counted++
  }
  if (counted < PACE.MIN_SESSIONS || cards < PACE.MIN_CARDS || seconds <= 0) return null
  return Math.min(PACE.MAX, Math.max(PACE.MIN, cards / (seconds / 60)))
}

export interface SessionSize {
  /** Cards this sitting will hold. */
  targetCount: number
  /** Cards per minute this was sized with — measured, or the cold-start value. */
  pace: number
  /** The whole day's allowance at that pace. */
  dailyTarget: number
  /** …of which this much is already covered by time studied today. */
  doneToday: number
  /** What's left of the day before the per-sitting cap is applied. */
  remaining: number
  /** The day's goal is already met and this session is an extra. */
  bonus: boolean
}

/**
 * How big *this* sitting should be.
 *
 * Two things the old `smartTargetCount(goalSec)` got wrong, and both were
 * visible from the first screen: it sized every session to the WHOLE daily goal
 * (so a 60-minute goal opened on a 132-card wall), and it had no memory of the
 * day (so leaving at 14/132 and coming back offered another 132 — the work
 * already done counted for nothing).
 *
 * The daily goal is a *time* goal, and `dailyTime.ts` already keeps an honest
 * per-day second count that survives an abandoned session. So: convert the goal
 * to cards at the learner's own pace, subtract what the time already studied is
 * worth, and cap what's left to one sitting. Come back mid-day and you get the
 * remainder; come back after the goal is met and you get a short extra rather
 * than a fresh mountain.
 */
export function smartSessionSize(args: {
  goalSec: number
  /** Seconds studied today in any mode — the same number the goal ring shows. */
  secondsStudiedToday?: number
  /** Session history, for the measured pace. Omitted = cold-start pace. */
  sessions?: Session[]
  today?: string
}): SessionSize {
  const pace =
    (args.sessions ? measuredCardsPerMin(args.sessions, args.today) : null) ?? SMART.CARDS_PER_MIN
  const dailyTarget = Math.round((args.goalSec / 60) * pace)
  const doneToday = Math.round((Math.max(0, args.secondsStudiedToday ?? 0) / 60) * pace)
  const remaining = Math.max(0, dailyTarget - doneToday)
  // Nothing left of the goal is not "nothing to do": the mode stays open, it
  // just offers a MIN_CARDS extra rather than restarting the day.
  return {
    targetCount: remaining === 0 ? SMART.MIN_CARDS : clampCards(remaining),
    pace,
    dailyTarget,
    doneToday,
    remaining,
    bonus: remaining === 0,
  }
}

/** Cold-start size for a goal with no history and nothing studied yet. */
export function smartTargetCount(goalSec: number): number {
  return smartSessionSize({ goalSec }).targetCount
}

interface SelectArgs {
  snapshot: ProgressSnapshot
  comfortLevel: number
  todayLevel: number | null
  goalSec: number
  /** Seconds already studied today (any mode). Omitted = nothing done yet, so
   *  the sitting is sized against the full goal. */
  secondsStudiedToday?: number
  /** Omitted = neutral: the baseline ratio, no stretch gate, as before the
   *  review-health loop existed. */
  reviewHealth?: ReviewHealth
}

export function selectSmart({
  snapshot, comfortLevel, todayLevel, goalSec, secondsStudiedToday,
  reviewHealth = EMPTY_REVIEW_HEALTH,
}: SelectArgs): SmartSelection {
  const size = smartSessionSize({
    goalSec,
    secondsStudiedToday,
    sessions: snapshot.sessions,
  })
  const targetCount = size.targetCount
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
  // A due word whose pack is no longer in the catalog can never become a card:
  // `composeSmartSteps` has nowhere to read its text from, so it is dropped at
  // the end and the slot it reserved is simply lost. Worse, it stays due
  // forever — nothing can answer it and reschedule it — so it reserves that
  // slot again in every session after this one. Leave those rows alone (they
  // are the learner's history, and a catalog can come back), but stop letting
  // them size the review stream.
  const orderedDue = orderDueWords(
    snapshot.dueWords.filter(w => PACK_LEVEL.has(w.packageId)),
    ctx
  )

  const stragglerPacks = scoped.filter(isStraggler)
  const stragglerPackIds = new Set(stragglerPacks.map(p => p.id))
  // How close each straggler pack is to being finished — 1 word left beats 2.
  // scoreDueWord (reviewQueue.ts) doesn't apply here: these words carry no
  // FSRS schedule yet (no stability, no nextReviewAt), so every one of them
  // ties as "fragile young" and the real order would fall back to
  // wordProgress's incidental array position — not urgency, just accident.
  const stragglerLeftById = new Map(stragglerPacks.map(p => [p.id, unknownEstimate(p)]))
  const seen = new Set(orderedDue.map(w => w.wordId))
  const stragglerWords = snapshot.wordProgress
    .filter(wp => stragglerPackIds.has(wp.packageId) && wp.status !== 'known' && !seen.has(wp.wordId))
    .sort((a, b) => {
      const byCloseness = (stragglerLeftById.get(a.packageId) ?? Infinity)
        - (stragglerLeftById.get(b.packageId) ?? Infinity)
      if (byCloseness !== 0) return byCloseness
      return (a.lastSeen ?? '').localeCompare(b.lastSeen ?? '') // longest-neglected first
    })

  // How much of the session is maintenance. A strong run buys more new words;
  // a slipping one buys more review — except while the backlog is already
  // urgent, where a good streak doesn't get to shrink the review slice at all.
  const reviewRatio = reviewRatioFor(reviewHealth, {
    base: SMART.REVIEW_RATIO,
    urgent: snapshot.reviewUrgency === 'urgent',
  })
  const reviewTarget = Math.round(targetCount * reviewRatio)

  // Real due words are normally gated by today's serving budget; leftovers are a
  // finish-the-job concern and ignore it (but the whole review slice still
  // can't take over the session).
  //
  // The budget exists to cap how much TIME reviews take, which is why /powtorka
  // obeys it strictly. Here they cost none: the session is `targetCount` cards
  // either way, so a review displaces a learn card rather than adding to the
  // day. So when health says the learner is behind, the slice is allowed past a
  // spent budget — without that, raising the ratio would be a no-op for exactly
  // the person it's meant to help.
  // `reviewRatio` only exceeds base when reviewHealth had a *fresh* signal to
  // move it. A stale/absent signal (>STALE_DAYS, or too few samples — e.g. a
  // returning learner after a long break) makes reviewRatioFor fall back to
  // `base` even while `reviewUrgency` — computed straight from the live
  // backlog, no health signal required — already says 'urgent'. Falling
  // through to the servingLeft gate in that case is exactly what let a real
  // backlog go unserved once the day's /powtorka budget was already spent.
  const behind = reviewRatio > SMART.REVIEW_RATIO || snapshot.reviewUrgency === 'urgent'
  const dueCap = behind
    ? reviewTarget
    : snapshot.servingLeft === 0
      ? 0
      : Math.min(reviewTarget, snapshot.servingLeft)
  const reviewWords = [
    ...orderedDue.slice(0, dueCap),
    ...stragglerWords,
  ].slice(0, reviewTarget + Math.min(stragglerWords.length, SMART.STRAGGLER_OVERFLOW))

  // ── stretch stream ───────────────────────────────────────────────────────
  const learnCandidates = scoped.filter(p => !isFullyKnown(p) && !isStraggler(p))
  const learnPackLevel = learnCandidates[0]?.level ?? floor
  const targetLevel = Math.min(4, Math.round(comfortLevel))
  let stretchPackId: string | null = null
  let stretchTarget = 0
  // Comfort says the harder material would fit; health has a veto. Stacking the
  // hardest new words on a memory that's already leaking is the one combination
  // the mode should never produce.
  if (allowStretch(reviewHealth) && comfortLevel >= learnPackLevel + 0.6 && targetLevel > learnPackLevel) {
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
  // MAX_PACKS was a flat 8 — enough for ~80 words at a 10-word pack, well
  // short of MAX_CARDS=132. Size the cap to what's actually on offer: enough
  // packs, at their real (smallest) size, to reach learnTarget — floored at
  // MAX_PACKS, hard-bounded so a pathological catalog can't fan out into
  // dozens of parallel pack-content fetches.
  const smallestCandidateSize = learnCandidates.reduce(
    (min, p) => Math.min(min, p.wordCount), Infinity
  )
  const learnPackCap = Number.isFinite(smallestCandidateSize) && smallestCandidateSize > 0
    ? Math.min(SMART.MAX_PACKS_HARD_CEILING, Math.max(SMART.MAX_PACKS, Math.ceil(learnTarget / smallestCandidateSize)))
    : SMART.MAX_PACKS
  // Line up LEARN_RESERVE words beyond the quota: a stream that can only just
  // reach its target has no answer to a pack that fails to load or turns out
  // already known, and the session silently comes up short.
  const learnSupply = learnTarget > 0 ? learnTarget + SMART.LEARN_RESERVE : 0
  const learnPackIds: string[] = []
  let acc = 0
  for (const p of learnCandidates) {
    if (p.id === stretchPackId) continue
    if (acc >= learnSupply || learnPackIds.length >= learnPackCap) break
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
    size,
    quota: { learn: learnTarget, review: reviewWords.length, stretch: stretchTarget },
    reviewRatio,
    tone: healthTone(reviewHealth),
    learnPackIds,
    stretchPackId,
    reviewWords,
    packIds,
  }
}

export interface SmartPreview {
  learn: number
  review: number
  stretch: number
  minutes: number
  tone: HealthTone | null
  /** True when the mix visibly departs from the baseline — the start card only
   *  explains itself when there's actually something to explain. */
  adapted: boolean
  /** The day's goal is already covered; this session is a voluntary extra. */
  bonus: boolean
}

/**
 * What a selection adds up to, for whoever has to describe it.
 *
 * Split out of `smartPeek` so `useSmartSession` can publish the mix the moment
 * `selectSmart` returns — after one IndexedDB read, before the per-pack
 * /pack-content fetches — instead of running the whole selection a second time.
 * The session's curtain is up across exactly that window.
 */
export function previewOf(sel: SmartSelection): SmartPreview {
  const total = sel.quota.learn + sel.quota.review + sel.quota.stretch
  return {
    learn: sel.quota.learn,
    review: sel.quota.review,
    stretch: sel.stretchPackId ? sel.quota.stretch : 0,
    tone: sel.tone,
    adapted: Math.abs(sel.reviewRatio - SMART.REVIEW_RATIO) > 0.01,
    bonus: sel.size.bonus,
    // estimateMinutes' *default* pace is 8 s/word, meant for browsing a plain
    // pack — reusing it here undersold a session by ~3x. Pass the pace this
    // sitting was actually sized with (measured where possible) so the two
    // numbers can't disagree, and so the estimate is falsifiable: a learner
    // slower than the constant gets a shorter session, not a longer minute.
    minutes: estimateMinutes(total || sel.targetCount, sel.size.pace),
  }
}

/** Cheap composition summary for the "today's mix" start card — no fetch. */
export function smartPeek(args: SelectArgs): SmartPreview {
  return previewOf(selectSmart(args))
}

/**
 * The one line that explains an adapted mix, or null when nothing moved.
 *
 * Shared by the Dzisiaj start card and the session's own curtain: two screens
 * describing one decision must not carry two copies of the sentence. The
 * goal-met line wins — a learner who has already put the time in should be told
 * that first, not why the ratio shifted.
 */
export function smartReason(p: SmartPreview): string | null {
  if (p.bonus) return 'Cel na dziś masz z głowy — to krótka dokładka, jeśli masz ochotę.'
  if (!p.adapted) return null
  if (p.tone === 'strong') return 'Powtórki trzymają się mocno, więc dziś więcej nowych słów.'
  if (p.tone === 'slipping') return 'Kilka słów zaczyna uciekać, więc dziś więcej powtarzamy.'
  return null
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
  opensWith: { segment: SmartSegment; count: number } | null
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

  const stretchCards = selection.stretchPackId
    ? takeFromPacks([selection.stretchPackId], 'stretch', selection.quota.stretch)
    : []

  // Priority order (orderDueWords) decides WHICH words get reviewed; inside the
  // block they're then grouped by pack. Same words, same count — but the run
  // stops hopping between packs on every card, which is what made a session
  // read as "16 paczek" and kept the audio layer swapping pack after pack.
  // Map iteration is insertion order, so packs still appear in the order their
  // most urgent word did.
  const reviewByPack = new Map<string, Extract<SmartStep, { kind: 'card' }>[]>()
  for (const wp of selection.reviewWords) {
    const pack = packs.get(wp.packageId)
    const word = pack?.words.find(w => w.id === wp.wordId)
    if (!word) continue
    usedPacks.add(wp.packageId)
    const bucket = reviewByPack.get(wp.packageId) ?? []
    bucket.push({ kind: 'card', segment: 'review', word, packageId: wp.packageId, progress: wp })
    reviewByPack.set(wp.packageId, bucket)
  }
  const reviewCards = [...reviewByPack.values()].flat()

  /**
   * Learn is taken LAST, against what the other two streams actually produced.
   *
   * `quota.learn` is what was left after the review stream was *selected*, and a
   * selected review word is not a card yet: it becomes one only if its pack
   * arrived and still contains that word id. Every one that doesn't used to
   * vanish here in silence, with its slot going with it — the session had
   * already spent that slot on review when it decided how much to learn. A run
   * whose review words all failed to resolve was left with `quota.learn` cards
   * and nothing else, which is how a sitting announced as 14 words could open,
   * and end, on a single card. It repeats for as long as those words stay
   * unresolvable, because nothing about the failure changes their schedule.
   *
   * So the remainder is recomputed from real cards. `learnPackIds` carries
   * SMART.LEARN_RESERVE words of slack precisely so there is something to take.
   */
  const learnLimit = Math.max(
    selection.quota.learn,
    selection.targetCount - reviewCards.length - stretchCards.length
  )
  const learnCards = takeFromPacks(selection.learnPackIds, 'learn', Math.max(0, learnLimit))

  const warmup = learnCards.slice(0, SMART.WARMUP_LEARN)
  const restLearn = learnCards.slice(SMART.WARMUP_LEARN)

  // An info step is a HAND-OFF: it explains why what's being asked of you just
  // changed. With nothing before it there is no change to explain, and it stops
  // being a hand-off and becomes a second opening screen — which is exactly
  // what it was, stacked on top of the curtain, whenever `warmup` came out
  // empty (quota.learn of 0, or every learn candidate already known). What the
  // run opens with is the curtain's job to say; see `opensWith` below.
  const steps: SmartStep[] = [...warmup]
  if (reviewCards.length) {
    if (steps.length) steps.push({ kind: 'info', variant: 'review-ahead', count: reviewCards.length })
    steps.push(...reviewCards)
  }
  if (stretchCards.length) {
    if (steps.length) steps.push({ kind: 'info', variant: 'stretch-ahead', count: stretchCards.length })
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
    opensWith: openingRun(steps),
  }
}

/**
 * The segment the run opens with and how many cards that opening block holds.
 *
 * The curtain announces this, which is the whole reason a review-first run no
 * longer needs an info step to do the announcing. Read from the composed steps
 * rather than from the quota on purpose: `quota.learn` is a target, and a
 * session whose learn candidates all turn out already-known opens on review
 * while the quota still claims otherwise.
 *
 * The count is the opening block, not the segment's total — "zaczynamy od
 * powtórki, 8 słów" should mean the eight you are about to do, not eight
 * scattered through the sitting.
 */
function openingRun(steps: SmartStep[]): { segment: SmartSegment; count: number } | null {
  const first = steps.find(s => s.kind === 'card')
  if (!first || first.kind !== 'card') return null

  let count = 0
  for (const step of steps) {
    if (step.kind !== 'card') {
      if (count > 0) break // a hand-off card closes the opening block
      continue
    }
    if (step.segment !== first.segment) break
    count++
  }
  return { segment: first.segment, count }
}
