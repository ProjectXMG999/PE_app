import { useEffect, useState } from 'react'

/**
 * Three English words per pack, for the card previews.
 *
 * One fetch for the whole catalogue (~15 kB gzipped), shared by all 864 cards
 * and cached by the service worker — not a request per card. Loaded lazily on
 * the first card mount, so it never touches startup.
 *
 * Failure is silent by design: previews are an enhancement, and a card without
 * them falls back to showing its category.
 */

type Previews = Record<string, string[]>

let cache: Previews | null = null
let inflight: Promise<Previews> | null = null
const listeners = new Set<() => void>()

function load(): Promise<Previews> {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight
  inflight = fetch('/data/pack-previews.json')
    .then(r => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((data: Previews) => {
      cache = data
      inflight = null
      listeners.forEach(fn => fn())
      return data
    })
  return inflight
}

export function usePackWords(packId: string): string[] | null {
  const [, force] = useState(0)

  useEffect(() => {
    if (cache) return
    const notify = () => force(n => n + 1)
    listeners.add(notify)
    void load()
    return () => { listeners.delete(notify) }
  }, [])

  return cache?.[packId] ?? null
}
