import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAppStore } from './store/useAppStore'
import { initInstallService } from './services/installService'
import { DebugOverlay } from './components/debug/DebugOverlay'
import { VersionBadge } from './components/debug/VersionBadge'
import { HomePage } from './pages/HomePage'
import './App.css'

const FlashcardPage = lazy(() => import('./pages/FlashcardPage').then(m => ({ default: m.FlashcardPage })))
const StatsPage = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })))
const TrainingPage = lazy(() => import('./pages/TrainingPage').then(m => ({ default: m.TrainingPage })))
const TrainingExercisePage = lazy(() => import('./pages/TrainingExercisePage').then(m => ({ default: m.TrainingExercisePage })))
const PackPreviewPage = lazy(() => import('./pages/PackPreviewPage').then(m => ({ default: m.PackPreviewPage })))
const AutoplayModePage = lazy(() => import('./pages/AutoplayModePage').then(m => ({ default: m.AutoplayModePage })))
const FlashcardModePage = lazy(() => import('./pages/FlashcardModePage').then(m => ({ default: m.FlashcardModePage })))
const WordFlashPage = lazy(() => import('./pages/WordFlashPage').then(m => ({ default: m.WordFlashPage })))
const ActiveSentencePage = lazy(() => import('./pages/ActiveSentencePage').then(m => ({ default: m.ActiveSentencePage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))

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
  const location = useLocation()

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
          <Route path="/" element={<HomePage key={location.pathname} />} />
          <Route path="/pakiet/:packageId" element={<PackPreviewPage />} />
          <Route path="/pakiet/:packageId/start" element={<AutoplayModePage />} />
          <Route path="/pakiet/:packageId/fiszki-start" element={<FlashcardModePage />} />
          <Route path="/pakiet/:packageId/word-flash" element={<WordFlashPage />} />
          <Route path="/pakiet/:packageId/active-sentence" element={<ActiveSentencePage />} />
          <Route path="/pakiet/:packageId/:mode" element={<FlashcardPage key={location.pathname} />} />
          <Route path="/trening" element={<TrainingPage />} />
          <Route path="/trening/:exerciseId" element={<TrainingExercisePage />} />
          <Route path="/postęp" element={<StatsPage />} />
          <Route path="/ustawienia" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
      <DebugOverlay />
      <VersionBadge />
    </>
  )
}
