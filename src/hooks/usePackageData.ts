import { useState, useEffect, useRef } from 'react'
import { Pack } from '../types/vocabulary'

const cache = new Map<string, Pack>()

export function usePackageData(packId: string | null) {
  const [pack, setPack] = useState<Pack | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!packId) return

    if (cache.has(packId)) {
      setPack(cache.get(packId)!)
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)

    fetch(`/data/packs/${packId}.json`, { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error(`Pack ${packId} not found`)
        return r.json() as Promise<Pack>
      })
      .then(data => {
        cache.set(packId, data)
        setPack(data)
        setLoading(false)
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setLoading(false)
      })

    return () => ctrl.abort()
  }, [packId])

  return { pack, loading, error }
}
