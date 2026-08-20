import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'
import { EntitlementStatus } from '../types/entitlement'

interface AuthStore {
  user: User | null
  authLoading: boolean
  entitlementStatus: EntitlementStatus
  setUser: (u: User | null) => void
  setEntitlementStatus: (s: EntitlementStatus) => void
  hasAccess: () => boolean
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  authLoading: true,
  entitlementStatus: 'loading',
  setUser: (u) => set({ user: u, authLoading: false }),
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

function handleAuthedUser(user: User | null) {
  useAuthStore.getState().setUser(user)
  if (user) refreshEntitlement(user.id)
  else useAuthStore.getState().setEntitlementStatus('none')
}

/** Rehydrates auth/entitlement state on boot and keeps it in sync. Call once from App.tsx. */
export function initAuthListener(): () => void {
  if (!supabase) {
    useAuthStore.getState().setUser(null)
    useAuthStore.getState().setEntitlementStatus('none')
    return () => {}
  }

  supabase.auth.getSession().then(({ data }) => handleAuthedUser(data.session?.user ?? null))

  const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
    handleAuthedUser(session?.user ?? null)
  })

  return () => subscription.subscription.unsubscribe()
}
