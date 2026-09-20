import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, supabaseEnabled } from '../services/supabaseClient'
import { EntitlementStatus } from '../types/entitlement'
import { pullAndMergeProgress } from '../services/progressSync'

interface AuthStore {
  user: User | null
  accessToken: string | null
  authLoading: boolean
  entitlementStatus: EntitlementStatus
  setSession: (s: Session | null) => void
  setEntitlementStatus: (s: EntitlementStatus) => void
  hasAccess: () => boolean
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  authLoading: true,
  entitlementStatus: 'loading',
  setSession: (s) => set({ user: s?.user ?? null, accessToken: s?.access_token ?? null, authLoading: false }),
  setEntitlementStatus: (s) => set({ entitlementStatus: s }),
  hasAccess: () => get().entitlementStatus === 'active',
}))

export async function refreshEntitlement(userId: string) {
  const sb = await getSupabase()
  if (!sb) return
  const { data } = await sb
    .from('entitlements')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()
  useAuthStore.getState().setEntitlementStatus((data?.status as EntitlementStatus) ?? 'none')
}

// Only merge progress once per distinct user becoming known (boot restore or
// a real sign-in) — not on every TOKEN_REFRESHED event for the same user.
let lastSyncedUserId: string | null = null

function handleSession(session: Session | null) {
  useAuthStore.getState().setSession(session)
  const userId = session?.user?.id ?? null

  if (userId) {
    refreshEntitlement(userId)
    if (userId !== lastSyncedUserId) {
      lastSyncedUserId = userId
      pullAndMergeProgress(userId).catch(err => console.error('[progressSync] merge failed:', err))
    }
  } else {
    useAuthStore.getState().setEntitlementStatus('none')
    lastSyncedUserId = null
  }
}

/**
 * Rehydrates auth/entitlement state on boot and keeps it in sync. Call once
 * from App.tsx.
 *
 * Stays synchronous on purpose: App.tsx calls it as `useEffect(() =>
 * initAuthListener(), [])`, and React needs the cleanup function back
 * immediately — an async function would hand it a promise instead.
 *
 * So the client is loaded inside, and `cancelled` is load-bearing rather than
 * defensive: under React.StrictMode this effect mounts, tears down and mounts
 * again, and the teardown happens while the import is still in flight. Without
 * the flag the first run would still go on to subscribe after being cancelled,
 * leaking a listener and running pullAndMergeProgress twice.
 */
export function initAuthListener(): () => void {
  if (!supabaseEnabled) {
    useAuthStore.getState().setSession(null)
    useAuthStore.getState().setEntitlementStatus('none')
    return () => {}
  }

  let cancelled = false
  let unsubscribe: (() => void) | null = null

  void getSupabase().then(sb => {
    if (!sb || cancelled) return
    sb.auth.getSession().then(({ data }) => {
      if (!cancelled) handleSession(data.session)
    })
    const { data: subscription } = sb.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })
    unsubscribe = () => subscription.subscription.unsubscribe()
    // Lost the race: teardown ran while the client was still loading.
    if (cancelled) unsubscribe()
  })

  return () => {
    cancelled = true
    unsubscribe?.()
  }
}
