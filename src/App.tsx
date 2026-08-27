import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAppStore, resolveTheme } from './store/useAppStore'
import { initAuthListener } from './store/useAuthStore'
import { initInstallService } from './services/installService'
import { loadProgressSnapshot } from './hooks/useProgressData'
import { runStreakFreezeUpkeep } from './services/streakFreeze'
import { repairMasteryFlags } from './services/masteryRepair'
// Dev-only: exposes window.__seed / window.__clearProgress. The module body is
// guarded by import.meta.env.DEV, so the bundler drops it from production.
import './debug/seedProgress'
// Dev-only: auto signs into the local test account on boot. Also DEV-guarded.
import './debug/devAutoLogin'
import { DebugOverlay } from './components/debug/DebugOverlay'
import { ViewportProbe } from './components/debug/ViewportProbe' // TEMP: remove after iOS bottom-gap diagnosis
import { RequireEntitlement } from './components/auth/RequireEntitlement'
import { ToastHost } from './components/shared/ToastHost'
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
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const AccountPage = lazy(() => import('./pages/AccountPage').then(m => ({ default: m.AccountPage })))
const TodayPage = lazy(() => import('./pages/TodayPage').then(m => ({ default: m.TodayPage })))
const ReviewPage = lazy(() => import('./pages/ReviewPage').then(m => ({ default: m.ReviewPage })))

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
    const apply = () => {
      el.classList.add('no-transition')
      el.setAttribute('data-theme', resolveTheme(theme))
      // One rAF to let the attribute apply, then remove the class so transitions resume
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.remove('no-transition')
        })
      })
    }
    apply()
    // In "system" mode, follow live OS theme changes
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])

  useEffect(() => {
    initInstallService(
      (e) => setInstallPrompt(e as Parameters<typeof setInstallPrompt>[0]),
      () => setInstalled()
    )
  }, [])

  useEffect(() => initAuthListener(), [])

  // One-time data upkeep, before the streak / points / progress widgets read
  // it: heal packs stuck "mastered" with no known words, then run streak-freeze
  // upkeep so a rescued run is intact by the time the badge renders.
  useEffect(() => {
    ;(async () => {
      try { await repairMasteryFlags() } catch (err) { console.error('[mastery] repair failed:', err) }
      try { await runStreakFreezeUpkeep() } catch (err) { console.error('[streak] upkeep failed:', err) }
      // Badging API: show the learning streak on the installed PWA icon
      if (!('setAppBadge' in navigator)) return
      try {
        const s = await loadProgressSnapshot(true)
        if (s.streak > 0) navigator.setAppBadge(s.streak).catch(() => {})
        else navigator.clearAppBadge?.().catch(() => {})
      } catch { /* badge is best-effort */ }
    })()
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
          <Route path="/pakiet/:packageId" element={<RequireEntitlement><PackPreviewPage /></RequireEntitlement>} />
          <Route path="/pakiet/:packageId/start" element={<RequireEntitlement><AutoplayModePage /></RequireEntitlement>} />
          <Route path="/pakiet/:packageId/fiszki-start" element={<RequireEntitlement><FlashcardModePage /></RequireEntitlement>} />
          <Route path="/pakiet/:packageId/word-flash" element={<RequireEntitlement><WordFlashPage /></RequireEntitlement>} />
          <Route path="/pakiet/:packageId/active-sentence" element={<RequireEntitlement><ActiveSentencePage /></RequireEntitlement>} />
          <Route path="/pakiet/:packageId/:mode" element={<RequireEntitlement><FlashcardPage key={location.pathname} /></RequireEntitlement>} />
          <Route path="/trening" element={<RequireEntitlement><TrainingPage /></RequireEntitlement>} />
          <Route path="/trening/:exerciseId" element={<RequireEntitlement><TrainingExercisePage /></RequireEntitlement>} />
          <Route path="/dzis" element={<TodayPage />} />
          <Route path="/powtorka" element={<RequireEntitlement><ReviewPage /></RequireEntitlement>} />
          <Route path="/postęp" element={<StatsPage />} />
          <Route path="/ustawienia" element={<SettingsPage />} />
          <Route path="/logowanie" element={<LoginPage />} />
          <Route path="/konto" element={<AccountPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
      <ToastHost />
      <DebugOverlay />
      <ViewportProbe />{/* TEMP: remove after iOS bottom-gap diagnosis */}
    </>
  )
}
