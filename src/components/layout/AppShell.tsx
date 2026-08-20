import { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import './AppShell.css'

interface Props {
  children: ReactNode
  hideBottomNav?: boolean
  hideTopBar?: boolean
  hideSidebar?: boolean
}

export function AppShell({ children, hideBottomNav = false, hideTopBar = false, hideSidebar = hideBottomNav }: Props) {
  return (
    <div className={`appshell ${hideSidebar ? 'appshell--no-sidebar' : ''}`}>
      {!hideTopBar && <TopBar />}
      {!hideSidebar && <Sidebar />}
      <main className={`appshell__main ${hideBottomNav ? 'appshell__main--no-nav' : ''}`}>
        <div className="appshell__main-inner">{children}</div>
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
