import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { supabase } from '../services/supabaseClient'
import './LoginPage.css'

type Mode = 'signin' | 'signup' | 'reset'

const TITLES: Record<Mode, string> = {
  signin: 'Zaloguj się',
  signup: 'Załóż konto',
  reset: 'Zresetuj hasło',
}

export function LoginPage() {
  const navigate = useNavigate()
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

  return (
    <AppShell hideBottomNav hideSidebar>
      <div className="login">
        <div className="login__header">
          <span className="login__title">{TITLES[mode]}</span>
        </div>

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

            <button className="login__submit-btn" type="submit" disabled={busy}>
              {busy ? 'Chwileczkę…' : TITLES[mode]}
            </button>

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
      </div>
    </AppShell>
  )
}
