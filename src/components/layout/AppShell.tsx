import { ReactNode, useEffect } from 'react'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { useAppStore } from '../../store/useAppStore'
import './AppShell.css'

interface Props {
  children: ReactNode
  hideBottomNav?: boolean
  hideTopBar?: boolean
  hideSidebar?: boolean
  /** Defaults to following hideBottomNav (focus-mode pages hide both together),
   * but a page that hides only the tab bar — to replace it with its own fixed
   * action bar in that exact spot — can pass this separately. */
  hideAmbient?: boolean
  /** Defaults to following hideBottomNav too — true single-screen focus pages
   * (flashcard/session screens) want the shell itself to stop scrolling, since
   * the screen IS the content. But a page that only hides the tab bar while
   * still having real scrollable content (word list, related packs, …) needs
   * this split out, or hiding the nav silently breaks its own scrolling. */
  lockScroll?: boolean
}

export function AppShell({
  children, hideBottomNav = false, hideTopBar = false, hideSidebar = hideBottomNav, hideAmbient = hideBottomNav,
  lockScroll = hideBottomNav,
}: Props) {
  const setAmbientHidden = useAppStore(s => s.setAmbientHidden)

  // The ambient WebGL background mounts once at the app root (App.tsx) so
  // navigating between pages never tears down and rebuilds its GPU context —
  // each AppShell just tells it whether to fade out for this screen.
  useEffect(() => {
    setAmbientHidden(hideAmbient)
    return () => setAmbientHidden(false)
  }, [hideAmbient, setAmbientHidden])

  return (
    <div className={`appshell ${hideSidebar ? 'appshell--no-sidebar' : ''}`}>
      {!hideTopBar && <TopBar />}
      {!hideSidebar && <Sidebar />}
      <main
        className={`appshell__main ${hideBottomNav ? 'appshell__main--no-pad' : ''} ${lockScroll ? 'appshell__main--no-scroll' : ''}`}
      >
        <div className="appshell__main-inner">{children}</div>
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
