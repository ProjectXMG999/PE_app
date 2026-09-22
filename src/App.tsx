import { Suspense, lazy, useEffect, type ComponentType } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAppStore, resolveTheme } from './store/useAppStore'
import { initAuthListener } from './store/useAuthStore'
import { initInstallService } from './services/installService'
import { loadProgressSnapshot } from './hooks/useProgressData'
import { runStreakFreezeUpkeep } from './services/streakFreeze'
import { repairMasteryFlags } from './services/masteryRepair'
import { repairListenAxis } from './services/listenRepair'
import { flushOutbox } from './services/db'
// Dev-only: exposes window.__seed / window.__clearProgress. The module body is
// guarded by import.meta.env.DEV, so the bundler drops it from production.
import './debug/seedProgress'
// Dev-only: auto signs into the local test account on boot. Also DEV-guarded.
import './debug/devAutoLogin'
// Dev-only: ?safe=59 or window.__safe(59) fakes a Dynamic Island's insets so
// the safe-area work is visible in a desktop browser. Also DEV-guarded.
import './debug/safeArea'
import { DebugOverlay } from './components/debug/DebugOverlay'
import { RequireEntitlement } from './components/auth/RequireEntitlement'
import { LoadingFallback } from './components/shared/LoadingFallback'
import { PageErrorBoundary } from './components/shared/PageErrorBoundary'
import { ToastHost } from './components/shared/ToastHost'
import { AchievementWatcher } from './components/progress/AchievementWatcher'
import { AmbientBackground } from './components/ambient/AmbientBackground'
import { TodayPage } from './pages/TodayPage'
import { HOME, NavigationTracker } from './navigation/navigation'
import { registerPage, warmPages } from './navigation/pageChunks'
import './App.css'

/**
 * The route table, with each page's chunk registered against the paths it
 * serves so it can be fetched before it's tapped — see navigation/pageChunks.
 * The order matters exactly as much as it does below: the first pattern that
 * matches a path wins, so the specific pack routes precede the catch-all one.
 */
function lazyPage<M extends Record<string, unknown>>(
  load: () => Promise<M>, name: keyof M & string, match: RegExp,
) {
  registerPage(match, load)
  return lazy(() => load().then(m => ({ default: m[name] as ComponentType })))
}

const HomePage = lazyPage(() => import('./pages/HomePage'), 'HomePage', /^\/pakiety$/)
const PackPreviewPage = lazyPage(() => import('./pages/PackPreviewPage'), 'PackPreviewPage', /^\/pakiet\/[^/]+$/)
const AutoplayModePage = lazyPage(() => import('./pages/AutoplayModePage'), 'AutoplayModePage', /\/start$/)
const FlashcardModePage = lazyPage(() => import('./pages/FlashcardModePage'), 'FlashcardModePage', /\/fiszki-start$/)
const WordFlashPage = lazyPage(() => import('./pages/WordFlashPage'), 'WordFlashPage', /\/word-flash$/)
const ActiveSentencePage = lazyPage(() => import('./pages/ActiveSentencePage'), 'ActiveSentencePage', /\/active-sentence$/)
const FlashcardPage = lazyPage(() => import('./pages/FlashcardPage'), 'FlashcardPage', /^\/pakiet\/[^/]+\/[^/]+$/)
const TrainingPage = lazyPage(() => import('./pages/TrainingPage'), 'TrainingPage', /^\/trening$/)
const TrainingExercisePage = lazyPage(() => import('./pages/TrainingExercisePage'), 'TrainingExercisePage', /^\/trening\/[^/]+$/)
const ReviewPage = lazyPage(() => import('./pages/ReviewPage'), 'ReviewPage', /^\/powtorka$/)
const SmartSessionPage = lazyPage(() => import('./pages/SmartSessionPage'), 'SmartSessionPage', /^\/inteligentny$/)
const StatsPage = lazyPage(() => import('./pages/StatsPage'), 'StatsPage', /^\/postęp$/)
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage', /^\/ustawienia$/)
const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'LoginPage', /^\/logowanie$/)
const AccountPage = lazyPage(() => import('./pages/AccountPage'), 'AccountPage', /^\/konto$/)

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
      // The iOS status-bar band and the Chrome-on-Android address-bar tint.
      // It isn't CSS, so it doesn't follow [data-theme] on its own — before
      // this it was a static #010102 in index.html and the light theme ran
      // with a black band above a near-white app. Read from
      // --theme-color-meta rather than hard-coded here so the colour keeps one
      // home in tokens.css; the setAttribute above has already invalidated
      // style and getComputedStyle forces the recalc, so this reads the NEW
      // theme's value in the same tick.
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      if (meta) {
        const c = getComputedStyle(el).getPropertyValue('--theme-color-meta').trim()
        if (c) meta.content = c
      }
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
      try { await repairListenAxis() } catch (err) { console.error('[listen] repair failed:', err) }
      // Anything the Supabase mirror couldn't deliver last session.
      try { await flushOutbox() } catch (err) { console.error('[progressSync] flush failed:', err) }
      try { await runStreakFreezeUpkeep() } catch (err) { console.error('[streak] upkeep failed:', err) }
      // Badging API: show the learning streak on the installed PWA icon. Only
      // this last step is optional — the two repairs above feed the UI.
      if (cancelled) return
      if ('setAppBadge' in navigator) {
        try {
          const s = await loadProgressSnapshot(true)
          if (s.streak > 0) navigator.setAppBadge(s.streak).catch(() => {})
          else navigator.clearAppBadge?.().catch(() => {})
        } catch { /* badge is best-effort */ }
      }
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

  // Page chunks, shortly after the first screen is up — NOT behind the data
  // upkeep above, which can run for a second or more. A navigation into a chunk
  // that hasn't loaded is the one case where the app can't transition, so this
  // should be done long before anything is tapped. One fetch at a time, in the
  // background; it is only the view modules.
  useEffect(() => {
    const id = window.setTimeout(() => void warmPages(), 400)
    return () => clearTimeout(id)
  }, [])

  // Coming back online is the moment a queued write can finally land, and a
  // phone that studied through a dead spot is exactly the case the outbox is
  // for. The flush is a no-op when the queue is empty or nobody is signed in.
  useEffect(() => {
    const onOnline = () => void flushOutbox().catch(() => {})
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
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
      {/* Keyed by path so navigating away clears a crash: without that, one
          screen that throws would hold the app on its error page for good.
          Inside <Suspense>, so a chunk that fails to load is caught here too. */}
      <PageErrorBoundary key={location.pathname}>
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
      </PageErrorBoundary>
      <ToastHost />
      <AchievementWatcher />
      <DebugOverlay />
    </>
  )
}
