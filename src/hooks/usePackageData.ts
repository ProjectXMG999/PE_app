import { useState, useEffect, useRef } from 'react'
import { Pack } from '../types/vocabulary'
import { supabase } from '../services/supabaseClient'

const cache = new Map<string, Pack>()

/**
 * Fetches one pack's content, sharing the in-memory cache with the hook below.
 * Exported because the review queue pulls words from several packs at once and
 * can't go through a per-pack hook.
 */
export async function fetchPack(packId: string, signal?: AbortSignal): Promise<Pack> {
  const cached = cache.get(packId)
  if (cached) return cached

  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`/.netlify/functions/pack-content?pack=${encodeURIComponent(packId)}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`Pack ${packId} not found`)

  const pack = (await res.json()) as Pack
  cache.set(packId, pack)
  return pack
}

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

    supabase!.auth.getSession()
      .then(({ data }) => {
        const token = data.session?.access_token
        return fetch(`/.netlify/functions/pack-content?pack=${encodeURIComponent(packId)}`, {
          signal: ctrl.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      })
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
