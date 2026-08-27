import { useEffect, useState } from 'react'
import { getDueWordProgress } from '../services/db'
import { fetchPack } from './usePackageData'
import { Word } from '../types/vocabulary'
import { WordProgress } from '../types/progress'

/**
 * Builds one review session out of words due across many packs.
 *
 * Two limits, both deliberate. Pack content is fetched per pack through an
 * authenticated function, so an unbounded queue would fire dozens of requests
 * before the first card appeared; and a session the user can finish in about
 * four minutes is one they'll actually start.
 */
export const REVIEW_MAX_WORDS = 20
export const REVIEW_MAX_PACKS = 8

export interface ReviewItem {
  word: Word
  packageId: string
  progress: WordProgress
}

export interface ReviewSet {
  items: ReviewItem[]
  /** How many words are due in total, before the per-session cap. */
  dueTotal: number
  packCount: number
  loading: boolean
  error: string | null
}

export function useReviewSet(enabled = true): ReviewSet {
  const [state, setState] = useState<ReviewSet>({
    items: [], dueTotal: 0, packCount: 0, loading: enabled, error: null,
  })

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const ctrl = new AbortController()

    async function build() {
      try {
        const due = await getDueWordProgress()
        if (!alive) return

        if (due.length === 0) {
          setState({ items: [], dueTotal: 0, packCount: 0, loading: false, error: null })
          return
        }

        // Longest-overdue first, so the words most at risk come back soonest.
        const ordered = [...due].sort((a, b) =>
          (a.nextReviewAt ?? '').localeCompare(b.nextReviewAt ?? '')
        )

        // Take words until either cap is hit. Walking in due order and only then
        // bounding packs keeps the most urgent words in, rather than favouring
        // whichever pack happens to sort first.
        const chosen: WordProgress[] = []
        const packs = new Set<string>()
        for (const wp of ordered) {
          if (chosen.length >= REVIEW_MAX_WORDS) break
          if (!packs.has(wp.packageId) && packs.size >= REVIEW_MAX_PACKS) continue
          packs.add(wp.packageId)
          chosen.push(wp)
        }

        const loaded = await Promise.all(
          [...packs].map(id => fetchPack(id, ctrl.signal).catch(() => null))
        )
        if (!alive) return

        const wordsById = new Map<string, Word>()
        for (const pack of loaded) {
          if (pack == null) continue
          for (const w of pack.words) wordsById.set(w.id, w)
        }

        const items: ReviewItem[] = chosen
          .map(wp => {
            const word = wordsById.get(wp.wordId)
            return word ? { word, packageId: wp.packageId, progress: wp } : null
          })
          .filter((i): i is ReviewItem => i != null)

        setState({
          items,
          dueTotal: due.length,
          packCount: packs.size,
          loading: false,
          error: items.length === 0 ? 'Nie udało się wczytać słów do powtórki.' : null,
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
  }, [enabled])

  return state
}
