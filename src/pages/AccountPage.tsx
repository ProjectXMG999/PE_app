import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { HOME } from '../navigation/navigation'
import { AppShell } from '../components/layout/AppShell'
import { Row, Section } from '../components/settings/PrefsList'
import { ProgressMark } from '../components/brand/ProgressLogo'
import { fadeUp, fadeUpReduced, staggerContainer } from '../components/today/motion'
import { refreshEntitlement, useAuthStore } from '../store/useAuthStore'
import { getSupabase } from '../services/supabaseClient'
import { EntitlementPlan, EntitlementStatus } from '../types/entitlement'
import './AccountPage.css'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

const STATUS: Record<EntitlementStatus, { label: string; tone: 'ok' | 'warn' | 'muted' }> = {
  loading: { label: 'Sprawdzanie…', tone: 'muted' },
  none: { label: 'Brak dostępu', tone: 'muted' },
  active: { label: 'Aktywny', tone: 'ok' },
  canceled: { label: 'Wygasł', tone: 'warn' },
  past_due: { label: 'Zaległa płatność', tone: 'warn' },
}

const PLANS: { id: EntitlementPlan; name: string; tag?: string; desc: string }[] = [
  { id: 'subscription', name: 'Miesięcznie', desc: 'Pełny dostęp do całej trasy. Anulujesz w każdej chwili.' },
  { id: 'lifetime', name: 'Na zawsze', tag: 'Jednorazowo', desc: 'Jedna płatność i dostęp bez końca, z przyszłymi pakietami.' },
]

interface EntitlementDetails {
  plan: EntitlementPlan | null
  currentPeriodEnd: string | null
}

async function callFunction(path: string, body?: unknown): Promise<{ url: string } | null> {
  const supabase = await getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null

  try {
    const res = await fetch(`/.netlify/functions/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function StatusBadge({ status }: { status: EntitlementStatus }) {
  const s = STATUS[status]
  return <span className={`account__badge account__badge--${s.tone}`}>{s.label}</span>
}

/**
 * Konto — who you're signed in as, what access you have, and the few things
 * you can do about either.
 *
 * Built from the same parts as Ustawienia (PrefsList: kicker-labelled glass
 * cards, hairline rows, the same buttons), so the two pages read as one place.
 * The order is the order of what people come here for: access first, then
 * security, then signing out.
 */
export function AccountPage() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const item = reduced ? fadeUpReduced : fadeUp
  const { user, authLoading, entitlementStatus } = useAuthStore()
  const [params, setParams] = useSearchParams()

  const [details, setDetails] = useState<EntitlementDetails | null>(null)
  const [plan, setPlan] = useState<EntitlementPlan>('subscription')
  const [waiverAccepted, setWaiverAccepted] = useState(false)
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  const [pwOpen, setPwOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)

  // Back from Stripe (?checkout=success|cancelled). Read straight from the URL
  // and dropped from it only when the notice is dismissed — stripping it on
  // mount raced React's development double-mount and lost the notice.
  const checkout = params.get('checkout')
  function dismissCheckout() {
    const next = new URLSearchParams(params)
    next.delete('checkout')
    next.delete('anon')
    setParams(next, { replace: true })
  }

  // The webhook that activates access can land a few seconds after Stripe
  // redirects back — keep re-reading the entitlement briefly until it does.
  useEffect(() => {
    if (checkout !== 'success' || !user || entitlementStatus === 'active') return
    let tries = 0
    const id = window.setInterval(() => {
      tries++
      void refreshEntitlement(user.id)
      if (tries >= 10) window.clearInterval(id)
    }, 2000)
    return () => window.clearInterval(id)
  }, [checkout, user, entitlementStatus])

  // Plan and renewal date, for the access card. Status itself comes from the
  // auth store, which the rest of the app already relies on.
  useEffect(() => {
    if (!user) return
    let alive = true
    void getSupabase().then(sb => {
      if (!sb || !alive) return
      sb.from('entitlements')
        .select('plan, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (alive && data) setDetails({ plan: data.plan ?? null, currentPeriodEnd: data.current_period_end ?? null })
        })
    })
    return () => { alive = false }
  }, [user, entitlementStatus])

  async function handleSignOut() {
    const sb = await getSupabase()
    await sb?.auth.signOut()
    navigate(HOME)
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setPwError(null)

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
      const sb = await getSupabase()
      if (!sb) throw new Error('Logowanie nie jest skonfigurowane.')
      const { error } = await sb.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwDone(true)
      setPwOpen(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Coś poszło nie tak.')
    } finally {
      setPwBusy(false)
    }
  }

  async function handleCheckout() {
    setPayError(null)
    setBusy('checkout')
    const result = await callFunction('create-checkout-session', { plan })
    if (result?.url) { window.location.href = result.url; return }
    setBusy(null)
    setPayError('Nie udało się otworzyć płatności. Spróbuj ponownie za chwilę.')
  }

  async function handlePortal() {
    setPayError(null)
    setBusy('portal')
    const result = await callFunction('create-portal-session')
    if (result?.url) { window.location.href = result.url; return }
    setBusy(null)
    setPayError('Nie udało się otworzyć panelu płatności. Spróbuj ponownie za chwilę.')
  }

  const initial = (user?.email ?? '?').trim().charAt(0).toUpperCase()
  const title = !authLoading && !user ? 'Zaloguj się' : 'Twoje konto'

  return (
    <AppShell>
      <motion.div className="settings account" variants={staggerContainer} initial="hidden" animate="show">
        <motion.header className="settings__header" variants={item}>
          <p className="settings__kicker u-kicker">Konto</p>
          <h1 className="settings__title u-display">{title}</h1>
        </motion.header>

        <AnimatePresence initial={false}>
          {checkout && (
            <motion.div
              className={`account__notice account__notice--${checkout === 'success' ? 'ok' : 'muted'}`}
              role="status"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: -18 }}
              transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            >
              <span>
                {checkout === 'success'
                  ? entitlementStatus === 'active'
                    ? 'Dziękujemy! Dostęp jest aktywny — możesz wracać do nauki.'
                    : 'Dziękujemy! Aktywujemy Twój dostęp, to potrwa kilka sekund…'
                  : 'Płatność została przerwana. Nic nie pobraliśmy.'}
              </span>
              <button type="button" className="account__notice-close" onClick={dismissCheckout} aria-label="Zamknij komunikat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {authLoading ? (
          <motion.div variants={item} className="account__loading" aria-hidden="true">
            <div className="skeleton account__skeleton account__skeleton--profile" />
            <div className="skeleton account__skeleton" />
          </motion.div>
        ) : !user ? (
          <motion.section className="account__signin u-surface" variants={item}>
            <ProgressMark size={44} />
            <p className="account__signin-text">
              Zaloguj się, żeby zarządzać dostępem, zmienić hasło i mieć postęp na każdym urządzeniu.
            </p>
            <button type="button" className="account__cta u-cta" onClick={() => navigate('/logowanie')}>
              Zaloguj się
            </button>
          </motion.section>
        ) : (
          <>
            <motion.section className="account__profile u-surface" variants={item}>
              <span className="account__avatar" aria-hidden="true">{initial}</span>
              <span className="account__identity">
                <span className="account__email">{user.email}</span>
                <span className="account__since">
                  Konto od {formatDate(user.created_at)}
                </span>
              </span>
            </motion.section>

            <Section title="Dostęp">
              {entitlementStatus === 'active' ? (
                <>
                  <Row
                    inline
                    name={details?.plan === 'lifetime' ? 'Dostęp na zawsze' : 'Plan miesięczny'}
                    hint={
                      details?.plan === 'lifetime'
                        ? 'Opłacony jednorazowo. Nic więcej nie zapłacisz.'
                        : details?.currentPeriodEnd
                          ? `Odnawia się ${formatDate(details.currentPeriodEnd)}.`
                          : 'Pełny dostęp do całej trasy.'
                    }
                    control={<StatusBadge status="active" />}
                  />
                  {details?.plan !== 'lifetime' && (
                    <Row
                      inline
                      name="Płatności i faktury"
                      hint="Karta, faktury i anulowanie subskrypcji"
                      control={
                        <button type="button" className="account__btn" onClick={handlePortal} disabled={busy !== null}>
                          {busy === 'portal' ? 'Otwieram…' : 'Zarządzaj'}
                        </button>
                      }
                    />
                  )}
                </>
              ) : entitlementStatus === 'past_due' ? (
                <Row
                  inline
                  name="Płatność nie przeszła"
                  hint="Zaktualizuj kartę, żeby nie stracić dostępu do nauki."
                  control={
                    <button type="button" className="account__btn account__btn--primary" onClick={handlePortal} disabled={busy !== null}>
                      {busy === 'portal' ? 'Otwieram…' : 'Zaktualizuj'}
                    </button>
                  }
                />
              ) : (
                <div className="account__purchase">
                  <p className="account__purchase-lead">
                    {entitlementStatus === 'canceled'
                      ? 'Twoja subskrypcja wygasła. Wybierz plan, żeby wrócić do pełnego dostępu.'
                      : 'Wybierz plan, żeby odblokować całą trasę — wszystkie pakiety, powtórki i tryby.'}
                  </p>

                  <div className="account__plans" role="radiogroup" aria-label="Plan">
                    {PLANS.map(p => {
                      const active = plan === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={`account__plan${active ? ' account__plan--active' : ''}`}
                          onClick={() => setPlan(p.id)}
                        >
                          <span className="account__plan-radio" aria-hidden="true" />
                          <span className="account__plan-body">
                            <span className="account__plan-head">
                              <span className="account__plan-name">{p.name}</span>
                              {p.tag && <span className="account__plan-tag">{p.tag}</span>}
                            </span>
                            <span className="account__plan-desc">{p.desc}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <label className={`account__waiver${waiverAccepted ? ' account__waiver--on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={waiverAccepted}
                      onChange={e => setWaiverAccepted(e.target.checked)}
                    />
                    <span className="account__check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span>
                      Zgadzam się na natychmiastowe udostępnienie treści cyfrowych po dokonaniu płatności
                      i przyjmuję do wiadomości, że w związku z tym tracę prawo do odstąpienia od umowy
                      w terminie 14 dni.
                    </span>
                  </label>

                  <button
                    type="button"
                    className="account__cta u-cta"
                    onClick={handleCheckout}
                    disabled={busy !== null || !waiverAccepted}
                  >
                    {busy === 'checkout' ? 'Otwieram płatność…' : 'Przejdź do płatności'}
                  </button>
                  <p className="account__fineprint">
                    Płatność obsługuje Stripe. Po zakupie wracasz prosto tutaj.
                  </p>
                </div>
              )}

              {payError && <p className="account__error" role="alert">{payError}</p>}
            </Section>

            <Section title="Bezpieczeństwo">
              <Row
                inline
                name="Hasło"
                hint={pwDone ? 'Hasło zostało zmienione.' : 'Zmień hasło, którym logujesz się w aplikacji'}
                control={
                  <button
                    type="button"
                    className="account__btn"
                    aria-expanded={pwOpen}
                    aria-controls="account-password"
                    onClick={() => { setPwOpen(o => !o); setPwError(null); setPwDone(false) }}
                  >
                    {pwOpen ? 'Anuluj' : 'Zmień'}
                  </button>
                }
              />
              <AnimatePresence initial={false}>
                {pwOpen && (
                  <motion.form
                    id="account-password"
                    className="account__form"
                    onSubmit={handlePasswordChange}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.32, ease: EASE_OUT_EXPO }}
                  >
                    <div className="account__form-inner">
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
                          autoFocus
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
                      {pwError && <p className="account__error" role="alert">{pwError}</p>}
                      <button className="account__btn account__btn--primary account__btn--block" type="submit" disabled={pwBusy}>
                        {pwBusy ? 'Zapisuję…' : 'Zapisz nowe hasło'}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </Section>

            <Section title="Sesja">
              <Row
                inline
                name="Wyloguj się"
                hint="Na tym urządzeniu. Twój postęp zostaje na koncie."
                control={
                  <button type="button" className="settings__danger-btn" onClick={handleSignOut}>
                    Wyloguj
                  </button>
                }
              />
            </Section>
          </>
        )}
      </motion.div>
    </AppShell>
  )
}
