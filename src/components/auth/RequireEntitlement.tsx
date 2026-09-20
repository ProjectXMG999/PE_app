import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { LoadingFallback } from '../shared/LoadingFallback'

interface Props {
  children: ReactNode
}

/** Route guard for paid content — redirects to login or the account/upgrade page. */
export function RequireEntitlement({ children }: Props) {
  const { user, authLoading, entitlementStatus, hasAccess } = useAuthStore()
  const location = useLocation()

  // entitlementStatus starts 'loading' and only resolves after authLoading
  // flips false (refreshEntitlement fires once the session is known) — wait
  // for both, or a logged-in user briefly reads as unentitled and gets bounced.
  //
  // A spinner rather than `null`: this wait is about to get longer, because the
  // Supabase client is loaded on demand instead of in the main bundle, and a
  // blank screen for that window reads as a broken deep link.
  if (authLoading || entitlementStatus === 'loading') return <LoadingFallback />
  // Remember where the gate stopped you — path and navigation state, so the
  // page still knows its origin once you're signed in and sent back.
  if (!user) {
    return (
      <Navigate
        to="/logowanie"
        replace
        state={{ returnTo: location.pathname + location.search, returnState: location.state }}
      />
    )
  }
  if (!hasAccess()) return <Navigate to="/konto" replace />

  return <>{children}</>
}
