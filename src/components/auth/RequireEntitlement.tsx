import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

interface Props {
  children: ReactNode
}

/** Route guard for paid content — redirects to login or the account/upgrade page. */
export function RequireEntitlement({ children }: Props) {
  const { user, authLoading, entitlementStatus, hasAccess } = useAuthStore()

  // entitlementStatus starts 'loading' and only resolves after authLoading
  // flips false (refreshEntitlement fires once the session is known) — wait
  // for both, or a logged-in user briefly reads as unentitled and gets bounced.
  if (authLoading || entitlementStatus === 'loading') return null
  if (!user) return <Navigate to="/logowanie" replace />
  if (!hasAccess()) return <Navigate to="/konto" replace />

  return <>{children}</>
}
