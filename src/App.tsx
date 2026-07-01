import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAppStore } from './store/useAppStore'
import { initInstallService } from './services/installService'
import { HomePage } from './pages/HomePage'
import './App.css'

const FlashcardPage = lazy(() => import('./pages/FlashcardPage').then(m => ({ default: m.FlashcardPage })))
const StatsPage = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })))
const PackPreviewPage = lazy(() => import('./pages/PackPreviewPage').then(m => ({ default: m.PackPreviewPage })))

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
    }}>
      <div className="spinner" />
    </div>
  )
}

export function App() {
  const { theme, setInstallPrompt, setInstalled, setSwUpdateAvailable, setSwRegistration } = useAppStore()

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      if (r) setSwRegistration(r)
    },
    onNeedRefresh() {
      setSwUpdateAvailable(true)
    },
  })

  useEffect(() => {
    const el = document.documentElement
    el.classList.add('no-transition')
    el.setAttribute('data-theme', theme)
    // One rAF to let the attribute apply, then remove the class so transitions resume
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.remove('no-transition')
      })
    })
  }, [theme])

  useEffect(() => {
    initInstallService(
      (e) => setInstallPrompt(e as Parameters<typeof setInstallPrompt>[0]),
      () => setInstalled()
    )
  }, [])

  return (
    <>
      {needRefresh[0] && import.meta.env.PROD && (
        <div className="sw-update-toast">
          <span>Dostępna aktualizacja</span>
          <button onClick={() => { updateServiceWorker(true); window.location.reload() }}>Odśwież</button>
        </div>
      )}
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pakiet/:packageId" element={<PackPreviewPage />} />
          <Route path="/pakiet/:packageId/:mode" element={<FlashcardPage />} />
          <Route path="/statystyki" element={<StatsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </>
  )
}
