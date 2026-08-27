import { ReactNode, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAppStore, resolveTheme } from '../../store/useAppStore'
import { useAuthStore } from '../../store/useAuthStore'
import { ProgressPill } from './ProgressPill'
import './TopBar.css'

export interface TopBarAccountOverride {
  icon: ReactNode
  label: string
  onClick: () => void
}

interface Props {
  /** Swaps the account button for a page-specific action — PackPreviewPage
   * uses this slot for "previous pack" instead. Account access is still one
   * tap away from every other screen; this route just trades it for a more
   * useful control while browsing a pack's word list. */
  accountOverride?: TopBarAccountOverride
}

export function TopBar({ accountOverride }: Props) {
  const { theme, toggleTheme, devUnlocked, setDevUnlocked } = useAppStore()
  const { user, hasAccess } = useAuthStore()
  const navigate = useNavigate()
  const tapsRef = useRef<number[]>([])

  const version = import.meta.env.VITE_APP_VERSION || '1.0.0'
  const resolved = resolveTheme(theme)

  // Easter egg: 5 quick taps on the version string toggles the hidden
  // developer section in Personalizacja. Stops propagation so it doesn't
  // also trigger the surrounding logo cluster's navigate-home click.
  function handleVersionTap(e: React.MouseEvent) {
    e.stopPropagation()
    const now = Date.now()
    tapsRef.current = [...tapsRef.current.filter(t => now - t < 3000), now]
    if (tapsRef.current.length >= 5) {
      tapsRef.current = []
      setDevUnlocked(!devUnlocked)
    }
  }

  return (
    <header className="topbar">
      <div className="topbar__left">
        <img
          src="/icons/icon-192.png"
          alt="PE"
          className="topbar__pe-icon"
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer' }}
        />
        <ProgressPill />
      </div>

      <div className="topbar__center" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <span
          className="topbar__version"
          title={`Version ${version}`}
          onClick={handleVersionTap}
        >
          {version}
        </span>
      </div>

      <div className="topbar__actions">
        {accountOverride ? (
          <motion.button
            className="topbar__account-btn"
            onClick={accountOverride.onClick}
            aria-label={accountOverride.label}
            title={accountOverride.label}
            whileTap={{ scale: 0.9 }}
          >
            {accountOverride.icon}
          </motion.button>
        ) : (
          <motion.button
            className="topbar__account-btn"
            onClick={() => navigate('/konto')}
            aria-label="Konto"
            title="Konto"
            whileTap={{ scale: 0.9 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
            </svg>
            {(!user || !hasAccess()) && <span className="topbar__account-dot" aria-hidden="true" />}
          </motion.button>
        )}
        <motion.button
          className="topbar__theme-btn"
          onClick={toggleTheme}
          aria-label={resolved === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
          title={resolved === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
          whileTap={{ scale: 0.9 }}
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
        </motion.button>
      </div>
    </header>
  )
}
