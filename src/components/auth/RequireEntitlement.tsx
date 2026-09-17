import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

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
  if (authLoading || entitlementStatus === 'loading') return null
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
