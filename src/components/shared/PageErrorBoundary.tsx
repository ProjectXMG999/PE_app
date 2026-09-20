import { Component, ReactNode } from 'react'
import { AppShell } from '../layout/AppShell'
import './PageErrorBoundary.css'

/**
 * The last line of defence: what you see when a page throws while rendering.
 *
 * Without one of these, React 18 unmounts the entire tree on any render error —
 * and since every page mounts its own chrome inside itself, that leaves the
 * app as a background with nothing on it. The failure reads as "the packs
 * didn't load" or "there are empty blocks", which sends you looking for a data
 * bug that isn't there. A crash should say it crashed.
 *
 * Reset by `key` from the route (App.tsx): navigating somewhere else clears the
 * error, so one broken screen never traps you on it.
 */
interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Tagged so the debug overlay picks it up along with the audio/action logs.
    console.error('[action] render failed:', error.message, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    // Inside the shell, so the tab bar is still there: the screen that broke is
    // one of five, and the way out should be tapping another one rather than
    // reloading the app. The page that threw is gone, not the app.
    return (
      <AppShell>
        <div className="pageerror" role="alert">
          <span className="pageerror__mark" aria-hidden="true">⚠</span>
          <h1 className="pageerror__title">Ten ekran się nie wczytał</h1>
          <p className="pageerror__text">
            Twoje postępy są zapisane — nic nie przepadło. Spróbuj jeszcze raz albo przejdź gdzie indziej.
          </p>
          {import.meta.env.DEV && (
            <pre className="pageerror__detail">{error.message}</pre>
          )}
          <div className="pageerror__actions">
            <button
              type="button"
              className="pageerror__btn pageerror__btn--primary u-cta"
              onClick={() => this.setState({ error: null })}
            >
              Spróbuj ponownie
            </button>
            <a className="pageerror__btn" href="/dzis">Wróć na Dzisiaj</a>
          </div>
        </div>
      </AppShell>
    )
  }
}
