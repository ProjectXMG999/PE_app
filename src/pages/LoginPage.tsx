import { FormEvent, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HOME } from '../navigation/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { fadeUp, fadeUpReduced, staggerContainer } from '../components/today/motion'
import { ProgressLogo } from '../components/brand/ProgressLogo'
import { useAppStore, resolveTheme } from '../store/useAppStore'
import { getSupabase, supabaseEnabled } from '../services/supabaseClient'
import './LoginPage.css'
import { useTransitionNavigate } from '../navigation/transitions'

type Mode = 'signin' | 'signup' | 'reset'

const TITLES: Record<Mode, string> = {
  signin: 'Zaloguj się',
  signup: 'Załóż konto',
  reset: 'Zresetuj hasło',
}

const SUBTITLES: Record<Mode, string> = {
  signin: 'Zaloguj się, aby kontynuować naukę.',
  signup: 'Pierwszy trening zajmuje około 10 minut. Zacznijmy.',
  reset: 'Podaj e-mail, a wyślemy Ci link do zresetowania hasła.',
}

export function LoginPage() {
  const navigate = useTransitionNavigate()
  const location = useLocation()
  // Set by RequireEntitlement when it bounced you here. Only in-app paths —
  // never a protocol-relative '//host' handed in through history state.
  const gate = location.state as { returnTo?: unknown; returnState?: unknown } | null
  const returnTo = typeof gate?.returnTo === 'string' && gate.returnTo.startsWith('/') && !gate.returnTo.startsWith('//')
    ? gate.returnTo
    : null
  const reduced = useReducedMotion()
  // Atomic selectors — see the note in App.tsx. `toggleTheme` is a stable
  // setter, so that one never re-renders at all.
  const theme = useAppStore(s => s.theme)
  const toggleTheme = useAppStore(s => s.toggleTheme)
  const resolved = resolveTheme(theme)

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      // Loaded here rather than at module scope: the sign-in screen is a lazy
      // route, and this is the first moment the client is genuinely needed.
      const sb = await getSupabase()
      if (!sb) throw new Error('Logowanie nie jest jeszcze skonfigurowane.')
      if (mode === 'signin') {
        const { error: err } = await sb.auth.signInWithPassword({ email, password })
        if (err) throw err
        // Back to the page you were stopped at; the gate there sends you on to
        // Konto by itself if the account has no access yet.
        if (returnTo) navigate(returnTo, { replace: true, state: gate?.returnState })
        else navigate('/konto')
      } else if (mode === 'signup') {
        // Same omission as the reset below had. This one fails less visibly:
        // the confirm link hits Supabase's /auth/v1/verify first, so the address
        // IS confirmed and only the redirect afterwards dead-ends — the account
        // works, the user just gets a broken page for their trouble.
        const { error: err } = await sb.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/konto` },
        })
        if (err) throw err
        setMessage('Konto utworzone. Sprawdź maila, aby potwierdzić adres.')
      } else {
        // `redirectTo` is not optional in practice. Without it Supabase sends
        // the recovery link to the project's Site URL, which was still the
        // template default (http://localhost:3000) — so every reset mail landed
        // on an address that does not exist on the recipient's device, which is
        // exactly how "reset hasła nie działa" looked from the outside.
        //
        // window.location.origin rather than a constant, so a preview deploy
        // sends people back to the preview and localhost back to localhost.
        // The origin still has to be on Supabase's redirect allow list or the
        // Site URL is used anyway — see docs/auth-redirects.md.
        const { error: err } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/konto?reset=1`,
        })
        if (err) throw err
        setMessage('Wysłaliśmy link do zresetowania hasła. Otwórz go na tym urządzeniu.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coś poszło nie tak.')
    } finally {
      setBusy(false)
    }
  }

  const variants = reduced ? fadeUpReduced : fadeUp

  // hideAmbient is opted out of explicitly: hideBottomNav would otherwise fade
  // the background away, and the login screen is the one focus-mode page that
  // wants it. It used to mount a second <AmbientBackground/> of its own to win
  // it back — which now would mean a second WebGL context for the same picture.
  return (
    <AppShell hideBottomNav hideSidebar hideTopBar hideAmbient={false}>
      <div className="login">
        <motion.div
          className="login__inner"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div className="login__brand" variants={variants}>
            <button className="login__brand-mark" onClick={() => navigate(HOME, { direction: 'back' })} aria-label="Progress — strona główna">
              <ProgressLogo size={30} />
            </button>
            <motion.button
              className="login__theme-btn"
              onClick={toggleTheme}
              aria-label={resolved === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
              title={resolved === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
              whileTap={{ scale: 0.9 }}
            >
              {resolved === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </motion.button>
          </motion.div>

          <motion.div className="login__card" variants={variants}>
            <h1 className="login__title">{TITLES[mode]}</h1>
            <p className="login__subtitle">{SUBTITLES[mode]}</p>

            {!supabaseEnabled ? (
              <p className="login__notice">Logowanie nie jest jeszcze skonfigurowane.</p>
            ) : (
              <form className="login__form" onSubmit={handleSubmit}>
                <label className="login__field">
                  <span className="login__label">E-mail</span>
                  <input
                    type="email"
                    className="login__input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>

                {mode !== 'reset' && (
                  <label className="login__field">
                    <span className="login__label">Hasło</span>
                    <input
                      type="password"
                      className="login__input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      minLength={6}
                      required
                    />
                  </label>
                )}

                {error && <p className="login__error">{error}</p>}
                {message && <p className="login__message">{message}</p>}

                <motion.button
                  className="login__submit-btn"
                  type="submit"
                  disabled={busy}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                >
                  {busy ? 'Chwileczkę…' : TITLES[mode]}
                </motion.button>

                <div className="login__links">
                  {mode !== 'signin' && (
                    <button type="button" className="login__link" onClick={() => setMode('signin')}>
                      Mam już konto
                    </button>
                  )}
                  {mode !== 'signup' && (
                    <button type="button" className="login__link" onClick={() => setMode('signup')}>
                      Załóż konto
                    </button>
                  )}
                  {mode !== 'reset' && (
                    <button type="button" className="login__link" onClick={() => setMode('reset')}>
                      Zapomniałem hasła
                    </button>
                  )}
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      </div>
    </AppShell>
  )
}
