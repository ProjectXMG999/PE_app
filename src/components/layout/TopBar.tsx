import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAppStore, resolveTheme } from '../../store/useAppStore'
import { useAuthStore } from '../../store/useAuthStore'
import { MoonGlyph, SunGlyph } from '../mode/glyphs'
import { ProgressPill } from './ProgressPill'
import { ProgressLogo } from '../brand/ProgressLogo'
import { HOME } from '../../navigation/navigation'
import './TopBar.css'
import { useTransitionNavigate } from '../../navigation/transitions'

/** Screens that open with their own large title; once it scrolls away, the bar
 *  takes over the name, the way an iOS navigation bar does. */
const COMPACT_TITLES: Record<string, string> = {
  '/dzis': 'Dzisiaj',
  '/pakiety': 'Mapa',
}

/** Roughly the height of a large title block — past this it's out of view. */
const COMPACT_AFTER = 64

/**
 * The phone's top bar: brand and streak on the left, account on the right.
 *
 * The version string used to sit here too, in the middle; it (and its five-tap
 * developer easter egg) now lives at the foot of Ustawienia, which is what
 * freed the centre for the screen title. The theme toggle stays — switching
 * light/dark is a thing people do often enough to want one tap away, and
 * Ustawienia keeps the three-way control (jasny / ciemny / systemowy).
 */
export function TopBar() {
  const { user, hasAccess } = useAuthStore()
  const theme = useAppStore(s => s.theme)
  const toggleTheme = useAppStore(s => s.toggleTheme)
  const resolved = resolveTheme(theme)
  const navigate = useTransitionNavigate()
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
          onClick={() => navigate(HOME, { direction: 'lateral' })}
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
          className="topbar__icon-btn u-liquid"
          onClick={toggleTheme}
          aria-label={resolved === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
          title={resolved === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
          whileTap={{ scale: 0.9 }}
        >
          {resolved === 'dark' ? <SunGlyph size={20} weight={1.9} /> : <MoonGlyph size={20} weight={1.9} />}
        </motion.button>

        <motion.button
          className="topbar__icon-btn topbar__account-btn u-liquid"
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
