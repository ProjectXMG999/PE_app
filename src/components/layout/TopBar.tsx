import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../store/useAuthStore'
import { ProgressPill } from './ProgressPill'
import { ProgressLogo } from '../brand/ProgressLogo'
import { HOME } from '../../navigation/navigation'
import './TopBar.css'

/** Screens that open with their own large title; once it scrolls away, the bar
 *  takes over the name, the way an iOS navigation bar does. */
const COMPACT_TITLES: Record<string, string> = {
  '/dzis': 'Dzisiaj',
}

/** Roughly the height of a large title block — past this it's out of view. */
const COMPACT_AFTER = 64

/**
 * The phone's top bar: brand and streak on the left, account on the right.
 *
 * The version string and the theme toggle used to sit here too. The version
 * (and its five-tap developer easter egg) now lives at the foot of Ustawienia,
 * and the theme already had a proper control there — a bar that carries five
 * objects has no hierarchy left for the one screen title it needs to show.
 */
export function TopBar() {
  const { user, hasAccess } = useAuthStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const compactTitle = COMPACT_TITLES[pathname]
  const [scrolled, setScrolled] = useState(false)

  // The page scrolls inside AppShell's <main>, not the document, so listen there.
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.appshell__main')
    if (!main) return
    const onScroll = () => setScrolled(main.scrollTop > (compactTitle ? COMPACT_AFTER : 4))
    onScroll()
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [pathname, compactTitle])

  const compact = compactTitle != null && scrolled

  return (
    <header className={`topbar${scrolled ? ' topbar--scrolled' : ''}${compact ? ' topbar--compact' : ''}`}>
      <div className="topbar__left">
        <button
          type="button"
          className="topbar__brand"
          onClick={() => navigate(HOME)}
          aria-label="Progress — strona główna"
        >
          <ProgressLogo size={28} mark={false} />
        </button>
        <ProgressPill />
      </div>

      {compactTitle && (
        <p className="topbar__title" aria-hidden={!compact}>{compactTitle}</p>
      )}

      <div className="topbar__actions">
        <motion.button
          className="topbar__account-btn u-liquid"
          onClick={() => navigate('/konto')}
          aria-label="Konto"
          title="Konto"
          whileTap={{ scale: 0.9 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
          </svg>
          {(!user || !hasAccess()) && <span className="topbar__account-dot" aria-hidden="true" />}
        </motion.button>
      </div>
    </header>
  )
}
