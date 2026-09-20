import { useState, useEffect, useRef } from 'react'
import { Pack } from '../types/vocabulary'
import { getSupabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/useAuthStore'

const cache = new Map<string, Pack>()

/**
 * Fetches the entitlement token for a pack request.
 *
 * Reads it straight out of the auth store rather than going through
 * `supabase.auth.getSession()`. The store already holds `accessToken` — it is
 * set by the same `handleSession` that Supabase's own listener calls — so this
 * both drops a promise hop from every pack fetch and keeps this module out of
 * the Supabase dependency chain entirely.
 *
 * The one thing `getSession()` did that a store read does not is silently
 * refresh an expired token. That case is handled where it actually shows up: on
 * a 401, below.
 */
function tokenHeaders(): HeadersInit {
  const token = useAuthStore.getState().accessToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Forces a token refresh after a 401 and returns the fresh one.
 *
 * Only reachable from the retry path, so loading the Supabase client here is
 * free — by this point the user is signed in and the client is long since
 * loaded. `onAuthStateChange` fires TOKEN_REFRESHED off the back of this, which
 * writes the new token to the store, so later fetches heal themselves.
 */
async function refreshedToken(): Promise<string | null> {
  const sb = await getSupabase()
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function requestPack(packId: string, signal?: AbortSignal): Promise<Pack> {
  const url = `/.netlify/functions/pack-content?pack=${encodeURIComponent(packId)}`
  let res = await fetch(url, { signal, headers: tokenHeaders() })

  // A tab left open past token expiry used to be covered by getSession()'s
  // silent refresh. One retry restores that, and only that.
  if (res.status === 401) {
    const token = await refreshedToken()
    if (token) {
      res = await fetch(url, { signal, headers: { Authorization: `Bearer ${token}` } })
    }
  }

  if (!res.ok) throw new Error(`Pack ${packId} not found`)
  return (await res.json()) as Pack
}

/**
 * Fetches one pack's content, sharing the in-memory cache with the hook below.
 * Exported because the review queue pulls words from several packs at once and
 * can't go through a per-pack hook.
 */
export async function fetchPack(packId: string, signal?: AbortSignal): Promise<Pack> {
  const cached = cache.get(packId)
  if (cached) return cached

  const pack = await requestPack(packId, signal)
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

    requestPack(packId, ctrl.signal)
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
