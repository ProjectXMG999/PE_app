import { useEffect, useState } from 'react'
import { fetchPack } from './usePackageData'
import { loadProgressSnapshot } from './useProgressData'
import { selectSmart, composeSmartSteps, SmartStep, SmartSegment } from '../services/smartQueue'
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
  loading: boolean
  error: string | null
}

const EMPTY: SmartSession = {
  steps: [],
  counts: { learn: 0, review: 0, stretch: 0 },
  packCount: 0,
  loading: true,
  error: null,
}

export function useSmartSession(nonce = 0): SmartSession {
  const [state, setState] = useState<SmartSession>({ ...EMPTY })

  useEffect(() => {
    let alive = true
    const ctrl = new AbortController()

    async function build() {
      try {
        const snapshot = await loadProgressSnapshot()
        if (!alive) return

        const { comfortLevel, todayLevel, dailyGoalSec, reviewHealth } = useAppStore.getState()
        const selection = selectSmart({
          snapshot,
          comfortLevel,
          todayLevel,
          goalSec: dailyGoalSec,
          reviewHealth,
        })

        if (selection.packIds.length === 0) {
          setState({ ...EMPTY, loading: false })
          return
        }

        const loaded = await Promise.all(
          selection.packIds.map(id => fetchPack(id, ctrl.signal).catch(() => null))
        )
        if (!alive) return

        const packs = new Map<string, Pack>()
        for (const pack of loaded) if (pack) packs.set(pack.id, pack)

        const wordProgressById = new Map<string, WordProgress>(
          snapshot.wordProgress.map(wp => [wp.wordId, wp])
        )

        const { steps, counts, packCount } = composeSmartSteps({
          selection,
          packs,
          wordProgressById,
        })

        setState({
          steps,
          counts,
          packCount,
          loading: false,
          error: steps.some(s => s.kind === 'card') ? null : 'Nie udało się zbudować sesji.',
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
