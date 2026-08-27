import { ReactNode } from 'react'
import { TopBar, TopBarAccountOverride } from './TopBar'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { AmbientBackground } from '../today/AmbientBackground'
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
  /** Passed straight through to TopBar — swaps its account button for a
   * page-specific action. See TopBar's own doc comment. */
  topBarAccountOverride?: TopBarAccountOverride
}

export function AppShell({
  children, hideBottomNav = false, hideTopBar = false, hideSidebar = hideBottomNav, hideAmbient = hideBottomNav,
  lockScroll = hideBottomNav, topBarAccountOverride,
}: Props) {
  const showAmbient = !hideAmbient

  return (
    <div className={`appshell ${hideSidebar ? 'appshell--no-sidebar' : ''}`}>
      {showAmbient && <AmbientBackground />}
      {!hideTopBar && <TopBar accountOverride={topBarAccountOverride} />}
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
