import { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import './AppShell.css'

interface Props {
  children: ReactNode
  hideBottomNav?: boolean
  hideTopBar?: boolean
}

export function AppShell({ children, hideBottomNav = false, hideTopBar = false }: Props) {
  return (
    <div className="appshell">
      {!hideTopBar && <TopBar />}
      <main className={`appshell__main ${hideBottomNav ? 'appshell__main--no-nav' : ''}`}>
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
