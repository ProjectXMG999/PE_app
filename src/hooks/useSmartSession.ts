import { useEffect, useState } from 'react'
import { fetchPack } from './usePackageData'
import { loadProgressSnapshot } from './useProgressData'
import { todayProgress } from '../services/dailyTime'
import { selectSmart, composeSmartSteps, previewOf, SmartStep, SmartSegment, SmartPreview } from '../services/smartQueue'
import { useAppStore } from '../store/useAppStore'
import { Pack } from '../types/vocabulary'
import { WordProgress } from '../types/progress'

/**
 * Builds one Inteligentny session: pulls the progress snapshot, lets
 * `selectSmart` choose the learn / review / stretch words, fetches the packs
 * those words live in, and hands `composeSmartSteps` back a woven step list.
 * Mirrors `useReviewSet` — same fetch-per-pack, same abort/rebuild shape.
 */

export interface SmartSession {
  steps: SmartStep[]
  counts: Record<SmartSegment, number>
  packCount: number
  /** The mix, published as soon as `selectSmart` returns — one IndexedDB read
   *  in, before any /pack-content fetch. The session's curtain is up over that
   *  whole window, and a curtain that can't say what it is covering is a
   *  spinner with better typography. */
  preview: SmartPreview | null
  /** What the run actually opens with — known only once the steps are composed,
   *  and what lets the curtain announce a review-first session itself instead
   *  of handing that job to an info card with nothing before it. Null until
   *  then, and for an empty session. */
  opensWith: { segment: SmartSegment; count: number } | null
  /** Packs whose content could not be fetched, even after a retry. The session
   *  still runs on what did arrive — this is how the page can say so. */
  missing: number
  loading: boolean
  error: string | null
}

const EMPTY: SmartSession = {
  steps: [],
  counts: { learn: 0, review: 0, stretch: 0 },
  packCount: 0,
  preview: null,
  opensWith: null,
  missing: 0,
  loading: true,
  error: null,
}

/**
 * Fetches every pack the session needs, and says which ones never arrived.
 *
 * Two things the old one-liner (`fetchPack(id).catch(() => null)`) got wrong,
 * and both are invisible from the outside:
 *
 *  - it keyed the result map by the pack's OWN `id` field, while every lookup
 *    in `composeSmartSteps` uses the id we asked for. Those are the same string
 *    today; the day one blob disagrees, every card from that pack disappears
 *    with no error anywhere.
 *  - it swallowed the failure whole. A dropped pack took its cards with it,
 *    the curtain had already promised them, and nothing retried, logged, or
 *    told the learner. One flaky request read as "the mode is broken".
 *
 * One retry, because the failures worth surviving are transient (an expired
 * token racing the first request, a dropped connection); a 404 will simply
 * fail again and be reported.
 */
async function fetchPacks(ids: string[], signal: AbortSignal): Promise<{
  packs: Map<string, Pack>
  missing: string[]
}> {
  const packs = new Map<string, Pack>()

  const attempt = async (wanted: string[]): Promise<string[]> => {
    const failed: string[] = []
    await Promise.all(wanted.map(async id => {
      try {
        const pack = await fetchPack(id, signal)
        packs.set(id, pack)
        // Belt and braces: a pack that names itself differently is still
        // reachable under both keys rather than silently unreachable.
        if (pack.id && pack.id !== id) packs.set(pack.id, pack)
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err
        failed.push(id)
      }
    }))
    return failed
  }

  const failedOnce = await attempt(ids)
  const missing = failedOnce.length ? await attempt(failedOnce) : []
  return { packs, missing }
}

export function useSmartSession(nonce = 0): SmartSession {
  const [state, setState] = useState<SmartSession>({ ...EMPTY })

  useEffect(() => {
    let alive = true
    const ctrl = new AbortController()

    async function build() {
      try {
        // The day's time ledger is what makes a second sitting a *continuation*
        // rather than a restart: it survives a session nobody finished, so the
        // 14 cards done before walking away still shrink what's offered now.
        const [snapshot, today] = await Promise.all([loadProgressSnapshot(), todayProgress()])
        if (!alive) return

        const { comfortLevel, todayLevel, dailyGoalSec, reviewHealth } = useAppStore.getState()
        const selection = selectSmart({
          snapshot,
          comfortLevel,
          todayLevel,
          goalSec: dailyGoalSec,
          secondsStudiedToday: today.secondsStudied,
          reviewHealth,
        })

        // Out ahead of the fetches, so the curtain can name the session it is
        // covering. Deliberately no early `packCount`: `selection.packIds` is
        // packs *fetched*, `composeSmartSteps` reports packs *used*, and the
        // two disagree.
        const preview = previewOf(selection)
        setState(s => ({ ...s, preview }))

        if (selection.packIds.length === 0) {
          setState({ ...EMPTY, preview, loading: false })
          return
        }

        const { packs, missing } = await fetchPacks(selection.packIds, ctrl.signal)
        if (!alive) return

        const wordProgressById = new Map<string, WordProgress>(
          snapshot.wordProgress.map(wp => [wp.wordId, wp])
        )

        const { steps, counts, packCount, opensWith, unresolved } = composeSmartSteps({
          selection,
          packs,
          wordProgressById,
        })

        const hasCards = steps.some(s => s.kind === 'card')
        // Loud in the console, because a session quietly missing half its
        // content is the kind of thing that gets reported as "the mode is
        // broken" with nothing to go on. Both lines name the fault precisely:
        // packs that would not download, and progress rows pointing at words
        // their pack no longer contains (which no retry will ever fix).
        if (missing.length) {
          console.warn('[smart] pack content unavailable:', missing.join(', '))
        }
        if (unresolved.length) {
          const stale = unresolved.filter(u => u.reason === 'word')
          console.warn(
            `[smart] ${unresolved.length} review words produced no card`,
            { missingPacks: unresolved.length - stale.length, staleWords: stale }
          )
        }

        setState({
          steps,
          counts,
          packCount,
          preview,
          missing: missing.length,
          loading: false,
          opensWith,
          error: hasCards
            ? null
            : missing.length
              // Not "nothing to do": there IS work, its text just didn't arrive.
              // Saying "come back tomorrow" here sent the learner away from a
              // session that a retry would have built.
              ? 'Nie udało się pobrać treści paczek. Sprawdź połączenie i spróbuj ponownie.'
              : 'Nie udało się zbudować sesji.',
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
  }, [nonce])

  return state
}
