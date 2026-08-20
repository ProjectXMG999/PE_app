import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

interface Props {
  children: ReactNode
}

/** Route guard for paid content — redirects to login or the account/upgrade page. */
export function RequireEntitlement({ children }: Props) {
  const { user, authLoading, hasAccess } = useAuthStore()

  if (authLoading) return null
  if (!user) return <Navigate to="/logowanie" replace />
  if (!hasAccess()) return <Navigate to="/konto" replace />

  return <>{children}</>
}
