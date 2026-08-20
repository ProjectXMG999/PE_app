import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'
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

async function refreshEntitlement(userId: string) {
  if (!supabase) return
  const { data } = await supabase
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

/** Rehydrates auth/entitlement state on boot and keeps it in sync. Call once from App.tsx. */
export function initAuthListener(): () => void {
  if (!supabase) {
    useAuthStore.getState().setSession(null)
    useAuthStore.getState().setEntitlementStatus('none')
    return () => {}
  }

  supabase.auth.getSession().then(({ data }) => handleSession(data.session))

  const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
    handleSession(session)
  })

  return () => subscription.subscription.unsubscribe()
}
