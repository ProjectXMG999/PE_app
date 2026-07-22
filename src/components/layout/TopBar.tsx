import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, resolveTheme } from '../../store/useAppStore'
import './TopBar.css'

export function TopBar() {
  const { theme, toggleTheme, devUnlocked, setDevUnlocked } = useAppStore()
  const navigate = useNavigate()
  const tapsRef = useRef<number[]>([])

  const version = import.meta.env.VITE_APP_VERSION || '1.0.0'
  const resolved = resolveTheme(theme)

  // Easter egg: 5 quick taps on the version string toggles the hidden
  // developer section in Personalizacja.
  function handleVersionTap() {
    const now = Date.now()
    tapsRef.current = [...tapsRef.current.filter(t => now - t < 3000), now]
    if (tapsRef.current.length >= 5) {
      tapsRef.current = []
      setDevUnlocked(!devUnlocked)
    }
  }

  return (
    <header className="topbar">
      <img
        src="/icons/icon-192.png"
        alt="PE"
        className="topbar__pe-icon"
        onClick={() => navigate('/')}
        style={{ cursor: 'pointer' }}
      />

      <div className="topbar__center" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <img
          src={resolved === 'dark' ? '/icons/logo-white.svg' : '/icons/logo-dark.svg'}
          alt="Project English"
          className="topbar__logo-img"
          onError={(e) => {
            const t = e.currentTarget
            t.style.display = 'none'
            const fallback = t.nextElementSibling as HTMLElement
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        <div className="topbar__logo-fallback" style={{ display: 'none' }}>
          <span className="topbar__logo-text">PROJECT ENGLISH</span>
          <span className="topbar__logo-sub">NEW EDUCATION</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        <button
          className="topbar__theme-btn"
          onClick={toggleTheme}
          aria-label={resolved === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
          title={resolved === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
          style={{ marginBottom: '0px' }}
        >
          {resolved === 'dark' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
        <span
          style={{
            fontSize: '7px',
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
            opacity: 0.6,
            lineHeight: 1,
          }}
          title={`Version ${version}`}
          onClick={handleVersionTap}
        >
          {version}
        </span>
      </div>
    </header>
  )
}
