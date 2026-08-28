import { useEffect, useState } from 'react'
import { fetchPack } from './usePackageData'
import { loadProgressSnapshot, packLevelOf } from './useProgressData'
import { orderDueWords, planInterludes, PriorityCtx } from '../services/reviewQueue'
import { REVIEW_INTERLUDE_EVERY, REVIEW_INTERLUDES_ENABLED } from '../services/reviewConfig'
import { useAppStore } from '../store/useAppStore'
import packagesIndex from '../data/packages-index.json'
import { dayKey } from '../utils/day'
import { PackMeta, Word } from '../types/vocabulary'
import { WordProgress } from '../types/progress'

/**
 * Builds one review session out of the words due across many packs.
 *
 * Two kinds of limit, deliberately separate:
 *  - the DAILY serving (reviewQueue) caps how much of the backlog is shown today,
 *    so an advanced learner isn't buried. The user can opt past it: pass
 *    `overBudget` after finishing the day's serving.
 *  - REVIEW_MAX_WORDS / REVIEW_MAX_PACKS are the per-SESSION ceilings — pack
 *    content is fetched per pack through an authenticated function, so an
 *    unbounded queue would fire dozens of requests before the first card, and a
 *    session finishable in ~4 minutes is one the user will actually start.
 * See src/services/reviewConfig.ts for the serving knobs.
 */
export const REVIEW_MAX_WORDS = 20
export const REVIEW_MAX_PACKS = 8

const allPacks = packagesIndex as PackMeta[]

export interface ReviewCardStep {
  kind: 'card'
  word: Word
  packageId: string
  progress: WordProgress
}

export interface ReviewInterludeStep {
  kind: 'interlude'
  words: { word: Word; packageId: string }[]
}

/** One position in a review run — a flashcard, or a passive listening break. */
export type ReviewStep = ReviewCardStep | ReviewInterludeStep

export interface ReviewSet {
  /** Cards, with listening interludes spliced in when enabled. */
  steps: ReviewStep[]
  /** How many `card` steps `steps` holds. */
  cardCount: number
  /** Total due across the whole backlog, before the daily serving or session cap. */
  dueTotal: number
  /** How many of today's budget were still unshown when this set was built. */
  servingLeft: number
  /** Today's full review budget (before anything was served). */
  reviewBudget: number
  /** Today's budget already spent and backlog remains — offer "continue anyway". */
  exhausted: boolean
  packCount: number
  loading: boolean
  error: string | null
}

interface Options {
  /** Serve a session-sized batch regardless of the daily budget. */
  overBudget?: boolean
  /** Bump to force a rebuild (e.g. "keep going" after a finished session). */
  nonce?: number
}

const EMPTY: ReviewSet = {
  steps: [], cardCount: 0, dueTotal: 0, servingLeft: 0, reviewBudget: 0, exhausted: false,
  packCount: 0, loading: true, error: null,
}

export function useReviewSet(enabled = true, opts: Options = {}): ReviewSet {
  const { overBudget = false, nonce = 0 } = opts
  const [state, setState] = useState<ReviewSet>({ ...EMPTY, loading: enabled })

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const ctrl = new AbortController()

    async function build() {
      try {
        const snap = await loadProgressSnapshot()
        if (!alive) return

        const due = snap.dueWords
        const cap = overBudget
          ? Math.min(REVIEW_MAX_WORDS, due.length)
          : Math.min(REVIEW_MAX_WORDS, Math.max(0, snap.servingLeft))

        if (due.length === 0 || cap === 0) {
          setState({
            ...EMPTY,
            dueTotal: due.length,
            servingLeft: snap.servingLeft,
            reviewBudget: snap.reviewBudget,
            exhausted: cap === 0 && due.length > 0,
            loading: false,
          })
          return
        }

        const ctx: PriorityCtx = {
          today: dayKey(),
          todayLevel: useAppStore.getState().todayLevel,
          packLevelOf,
        }
        const ordered = orderDueWords(due, ctx)

        // Take words in priority order until the serving cap or the pack cap.
        const chosen: WordProgress[] = []
        const cardPacks = new Set<string>()
        for (const wp of ordered) {
          if (chosen.length >= cap) break
          if (!cardPacks.has(wp.packageId) && cardPacks.size >= REVIEW_MAX_PACKS) continue
          cardPacks.add(wp.packageId)
          chosen.push(wp)
        }

        const plan = REVIEW_INTERLUDES_ENABLED
          ? planInterludes({
              wordProgress: snap.wordProgress,
              progressMap: snap.progressMap,
              packs: allPacks,
              knownMap: snap.knownMap,
              cardCount: chosen.length,
            })
          : { packIds: [], reinforcementWordIds: [], perInterlude: 0, count: 0 }

        const allPackIds = new Set<string>([...cardPacks, ...plan.packIds])
        const loaded = await Promise.all(
          [...allPackIds].map(id => fetchPack(id, ctrl.signal).catch(() => null))
        )
        if (!alive) return

        const wordsById = new Map<string, Word>()
        const wordPackOf = new Map<string, string>()
        for (const pack of loaded) {
          if (pack == null) continue
          for (const w of pack.words) {
            wordsById.set(w.id, w)
            wordPackOf.set(w.id, pack.id)
          }
        }

        const cards: ReviewCardStep[] = chosen
          .map(wp => {
            const word = wordsById.get(wp.wordId)
            return word
              ? ({ kind: 'card', word, packageId: wp.packageId, progress: wp } as ReviewCardStep)
              : null
          })
          .filter((c): c is ReviewCardStep => c != null)

        const steps = spliceInterludes(cards, plan, wordsById, wordPackOf)

        setState({
          steps,
          cardCount: cards.length,
          dueTotal: due.length,
          servingLeft: snap.servingLeft,
          reviewBudget: snap.reviewBudget,
          exhausted: false,
          packCount: cardPacks.size,
          loading: false,
          error: cards.length === 0 ? 'Nie udało się wczytać słów do powtórki.' : null,
        })
      } catch (err) {
        if (!alive || (err as Error).name === 'AbortError') return
        setState(s => ({ ...s, loading: false, error: (err as Error).message }))
      }
    }

    build()
    return () => {
      alive = false
      ctrl.abort()
    }
  }, [enabled, overBudget, nonce])

  return state
}

/**
 * Weaves one listening interlude in after every `REVIEW_INTERLUDE_EVERY` cards,
 * never as the first or last step. Interlude words are drawn from the packs the
 * plan named plus its reinforcement wordIds; a partly-loaded pool just yields a
 * shorter interlude (or none, which is dropped).
 */
function spliceInterludes(
  cards: ReviewCardStep[],
  plan: ReturnType<typeof planInterludes>,
  wordsById: Map<string, Word>,
  wordPackOf: Map<string, string>
): ReviewStep[] {
  if (plan.count <= 0 || cards.length <= REVIEW_INTERLUDE_EVERY) return cards

  const cardWordIds = new Set(cards.map(c => c.word.id))
  const pool: { word: Word; packageId: string }[] = []

  // Reinforcement: already-known / retired words the plan picked.
  for (const id of plan.reinforcementWordIds) {
    const word = wordsById.get(id)
    const packageId = wordPackOf.get(id)
    if (word && packageId && !cardWordIds.has(id)) pool.push({ word, packageId })
  }
  // Main: words from the "not yet half learned" packs, minus anything already a card.
  for (const [id, packId] of wordPackOf) {
    if (!plan.packIds.includes(packId) || cardWordIds.has(id)) continue
    const word = wordsById.get(id)
    if (word) pool.push({ word, packageId: packId })
  }

  if (pool.length === 0) return cards

  const shuffled = shuffle(pool)
  let cursor = 0
  const out: ReviewStep[] = []
  let placed = 0

  for (let i = 0; i < cards.length; i++) {
    out.push(cards[i])
    const atBreak = (i + 1) % REVIEW_INTERLUDE_EVERY === 0
    const notLast = i < cards.length - 1
    if (atBreak && notLast && placed < plan.count && cursor < shuffled.length) {
      const words = shuffled.slice(cursor, cursor + plan.perInterlude)
      cursor += plan.perInterlude
      if (words.length > 0) {
        out.push({ kind: 'interlude', words })
        placed++
      }
    }
  }
  return out
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
