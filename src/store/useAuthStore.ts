import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'
import { EntitlementStatus } from '../types/entitlement'

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

function handleSession(session: Session | null) {
  useAuthStore.getState().setSession(session)
  if (session?.user) refreshEntitlement(session.user.id)
  else useAuthStore.getState().setEntitlementStatus('none')
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
