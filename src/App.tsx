import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import { RequireEntitlement } from './components/auth/RequireEntitlement'
import { LoadingFallback } from './components/shared/LoadingFallback'
import { ToastHost } from './components/shared/ToastHost'
import { AchievementWatcher } from './components/progress/AchievementWatcher'
import { AmbientBackground } from './components/ambient/AmbientBackground'
import { TodayPage } from './pages/TodayPage'
import { HOME, NavigationTracker } from './navigation/navigation'
import './App.css'

const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })))
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
const ReviewPage = lazy(() => import('./pages/ReviewPage').then(m => ({ default: m.ReviewPage })))
const SmartSessionPage = lazy(() => import('./pages/SmartSessionPage').then(m => ({ default: m.SmartSessionPage })))

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

  // One-time data upkeep: heal packs stuck "mastered" with no known words, then
  // run streak-freeze upkeep so a rescued run is intact, then badge the icon.
  //
  // Deferred to idle rather than run on mount. Between them these three steps
  // are two full reads of wordProgress (~11 000 rows) and three of sessions,
  // and they used to land in the middle of the first paint. Nothing on screen
  // waits for them — a pack stuck on a stale "opanowana" flag now heals a couple
  // of hundred milliseconds later than it did, which nobody can perceive.
  //
  // `force: true` on the snapshot load stays: by the time this runs, TodayPage
  // has already populated the 2 s dedupe cache, so without it the badge would be
  // computed from a snapshot taken BEFORE the two repairs above.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      try { await repairMasteryFlags() } catch (err) { console.error('[mastery] repair failed:', err) }
      try { await runStreakFreezeUpkeep() } catch (err) { console.error('[streak] upkeep failed:', err) }
      // Badging API: show the learning streak on the installed PWA icon. Only
      // this last step is optional — the two repairs above feed the UI.
      if (cancelled || !('setAppBadge' in navigator)) return
      try {
        const s = await loadProgressSnapshot(true)
        if (s.streak > 0) navigator.setAppBadge(s.streak).catch(() => {})
        else navigator.clearAppBadge?.().catch(() => {})
      } catch { /* badge is best-effort */ }
    }

    // Safari has no requestIdleCallback; the timeout is the fallback there and
    // the ceiling everywhere else, so upkeep can't be starved by a busy tab.
    const ric = (window as Window & typeof globalThis).requestIdleCallback
    if (typeof ric === 'function') {
      const id = ric(() => void run(), { timeout: 2000 })
      return () => { cancelled = true; window.cancelIdleCallback?.(id) }
    }
    const id = window.setTimeout(() => void run(), 200)
    return () => { cancelled = true; clearTimeout(id) }
  }, [])

  return (
    <>
      {/* Mounted once, above <Routes> — see AmbientBackground's doc comment for
          why it must not live inside the per-page AppShell. */}
      <AmbientBackground />
      <NavigationTracker />
      {needRefresh[0] && import.meta.env.PROD && (
        <div className="sw-update-toast">
          <span>Dostępna aktualizacja</span>
          <button onClick={() => { updateServiceWorker(true); window.location.reload() }}>Odśwież</button>
        </div>
      )}
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Dzisiaj is the start page: the root, the PWA start_url and any
              unknown path all land there. Pakiety has its own address. */}
          <Route path="/" element={<Navigate to={HOME} replace />} />
          <Route path="/pakiety" element={<HomePage key={location.pathname} />} />
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
          <Route path="/inteligentny" element={<RequireEntitlement><SmartSessionPage /></RequireEntitlement>} />
          <Route path="/postęp" element={<StatsPage />} />
          <Route path="/ustawienia" element={<SettingsPage />} />
          <Route path="/logowanie" element={<LoginPage />} />
          <Route path="/konto" element={<AccountPage />} />
          <Route path="*" element={<Navigate to={HOME} replace />} />
        </Routes>
      </Suspense>
      <ToastHost />
      <AchievementWatcher />
      <DebugOverlay />
    </>
  )
}
