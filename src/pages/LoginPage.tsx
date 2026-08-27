import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { AmbientBackground } from '../components/today/AmbientBackground'
import { fadeUp, fadeUpReduced, staggerContainer } from '../components/today/motion'
import { useAppStore, resolveTheme } from '../store/useAppStore'
import { supabase } from '../services/supabaseClient'
import './LoginPage.css'

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
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const { theme, toggleTheme } = useAppStore()
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
      if (mode === 'signin') {
        const { error: err } = await supabase!.auth.signInWithPassword({ email, password })
        if (err) throw err
        navigate('/konto')
      } else if (mode === 'signup') {
        const { error: err } = await supabase!.auth.signUp({ email, password })
        if (err) throw err
        setMessage('Konto utworzone. Sprawdź maila, aby potwierdzić adres.')
      } else {
        const { error: err } = await supabase!.auth.resetPasswordForEmail(email)
        if (err) throw err
        setMessage('Wysłaliśmy link do zresetowania hasła.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coś poszło nie tak.')
    } finally {
      setBusy(false)
    }
  }

  const variants = reduced ? fadeUpReduced : fadeUp

  return (
    <AppShell hideBottomNav hideSidebar hideTopBar>
      <div className="login">
        <AmbientBackground />

        <motion.div
          className="login__inner"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div className="login__brand" variants={variants}>
            <button className="login__brand-mark" onClick={() => navigate('/')} aria-label="Strona główna">
              <img src="/icons/icon-192.png" alt="" className="login__brand-icon" />
              <img
                src={resolved === 'dark' ? '/icons/logo-white.svg' : '/icons/logo-dark.svg'}
                alt="Project English"
                className="login__brand-logo"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
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

            {!supabase ? (
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
