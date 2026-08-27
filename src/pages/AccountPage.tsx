import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAuthStore } from '../store/useAuthStore'
import { supabase } from '../services/supabaseClient'
import { EntitlementPlan, EntitlementStatus } from '../types/entitlement'
import './AccountPage.css'

const STATUS_LABEL: Record<EntitlementStatus, string> = {
  loading: 'Sprawdzanie…',
  none: 'Brak aktywnego planu',
  active: 'Aktywna',
  canceled: 'Anulowana',
  past_due: 'Zaległa płatność',
}

async function callFunction(path: string, body?: unknown): Promise<{ url: string } | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null

  const res = await fetch(`/.netlify/functions/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) return null
  return res.json()
}

export function AccountPage() {
  const navigate = useNavigate()
  const { user, authLoading, entitlementStatus } = useAuthStore()
  const [busyPlan, setBusyPlan] = useState<EntitlementPlan | 'portal' | null>(null)
  const [waiverAccepted, setWaiverAccepted] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwMessage, setPwMessage] = useState<string | null>(null)

  async function handleSignOut() {
    await supabase?.auth.signOut()
    navigate('/')
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setPwError(null)
    setPwMessage(null)

    if (newPassword.length < 6) {
      setPwError('Hasło musi mieć co najmniej 6 znaków.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Hasła nie są takie same.')
      return
    }

    setPwBusy(true)
    try {
      const { error } = await supabase!.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwMessage('Hasło zostało zmienione.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Coś poszło nie tak.')
    } finally {
      setPwBusy(false)
    }
  }

  async function handleCheckout(plan: EntitlementPlan) {
    setBusyPlan(plan)
    const result = await callFunction('create-checkout-session', { plan })
    if (result?.url) window.location.href = result.url
    else setBusyPlan(null)
  }

  async function handlePortal() {
    setBusyPlan('portal')
    const result = await callFunction('create-portal-session')
    if (result?.url) window.location.href = result.url
    else setBusyPlan(null)
  }

  return (
    <AppShell>
      <div className="account">
        <div className="account__header">
          <span className="account__title">Konto</span>
        </div>

        {authLoading ? (
          <p className="account__hint">Ładowanie…</p>
        ) : !user ? (
          <div className="account__section">
            <p className="account__hint">Zaloguj się, aby zarządzać kontem i subskrypcją.</p>
            <button className="account__primary-btn" onClick={() => navigate('/logowanie')}>
              Zaloguj się
            </button>
          </div>
        ) : (
          <>
            <div className="account__section">
              <h2 className="account__section-title">Konto</h2>
              <div className="account__row">
                <div className="account__row-label">
                  <span className="account__row-name">E-mail</span>
                </div>
                <span className="account__row-value">{user.email}</span>
              </div>
            </div>

            <div className="account__section">
              <h2 className="account__section-title">Hasło</h2>
              <form className="account__form" onSubmit={handlePasswordChange}>
                <label className="account__field">
                  <span className="account__label">Nowe hasło</span>
                  <input
                    type="password"
                    className="account__input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </label>
                <label className="account__field">
                  <span className="account__label">Powtórz nowe hasło</span>
                  <input
                    type="password"
                    className="account__input"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </label>

                {pwError && <p className="account__form-error">{pwError}</p>}
                {pwMessage && <p className="account__form-message">{pwMessage}</p>}

                <button className="account__primary-btn" type="submit" disabled={pwBusy}>
                  {pwBusy ? 'Chwileczkę…' : 'Zmień hasło'}
                </button>
              </form>
            </div>

            <div className="account__section">
              <h2 className="account__section-title">Subskrypcja</h2>
              <div className="account__row">
                <div className="account__row-label">
                  <span className="account__row-name">Status</span>
                </div>
                <span className={`account__status-pill account__status-pill--${entitlementStatus}`}>
                  {STATUS_LABEL[entitlementStatus]}
                </span>
              </div>

              {entitlementStatus === 'active' ? (
                <button className="account__primary-btn" onClick={handlePortal} disabled={busyPlan === 'portal'}>
                  {busyPlan === 'portal' ? 'Chwileczkę…' : 'Zarządzaj płatnościami'}
                </button>
              ) : (
                <>
                  <label className="account__waiver">
                    <input
                      type="checkbox"
                      checked={waiverAccepted}
                      onChange={e => setWaiverAccepted(e.target.checked)}
                    />
                    <span>
                      Zgadzam się na natychmiastowe udostępnienie treści cyfrowych po dokonaniu płatności
                      i przyjmuję do wiadomości, że w związku z tym tracę prawo do odstąpienia od umowy
                      w terminie 14 dni.
                    </span>
                  </label>
                  <div className="account__plan-buttons">
                    <button
                      className="account__primary-btn"
                      onClick={() => handleCheckout('subscription')}
                      disabled={busyPlan !== null || !waiverAccepted}
                    >
                      {busyPlan === 'subscription' ? 'Chwileczkę…' : 'Subskrybuj miesięcznie'}
                    </button>
                    <button
                      className="account__primary-btn account__primary-btn--outline"
                      onClick={() => handleCheckout('lifetime')}
                      disabled={busyPlan !== null || !waiverAccepted}
                    >
                      {busyPlan === 'lifetime' ? 'Chwileczkę…' : 'Kup dostęp Lifetime'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="account__section">
              <button className="account__danger-btn" onClick={handleSignOut}>
                Wyloguj się
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
