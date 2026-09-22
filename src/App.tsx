import { Suspense, useEffect, type ComponentType } from 'react'
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
 *
 * ── Not `React.lazy`, and the difference is visible ─────────────────────────
 *
 * `lazy()` keeps its own idea of whether the chunk is here, and it only forms
 * that idea the first time React renders the component: the very first render
 * calls the loader, gets a promise back — a resolved one, for a module that was
 * warmed minutes ago — and suspends anyway, for one tick. `isPageLoaded` said
 * yes, so a view transition was already running around that render, and what it
 * photographed as "the new page" was <LoadingFallback>: a spinner, no AppShell,
 * no tab bar. The bar's old snapshot then floated frozen over the screen for the
 * whole 240ms and snapped to the new tab at the end, with the active-tab marker
 * fading to nothing in between — measured, on the first visit to every tab.
 *
 * Here the module cache IS the readiness, shared with pageChunks through the
 * loader below, so `entry.ready` and "renders in this tick" cannot disagree.
 */
function lazyPage<M extends Record<string, unknown>>(
  load: () => Promise<M>, name: keyof M & string, match: RegExp,
) {
  let mod: M | null = null
  let pending: Promise<M> | null = null

  // Both the warm-up and the render path go through this, so whichever runs
  // first fills the cache for the other.
  const fetch = () => {
    pending ??= load().then(
      m => { mod = m; return m },
      // Let a failed chunk be retried — the next render starts a fresh fetch
      // rather than re-throwing a rejection forever. pageChunks does the same
      // with its `started` flag, and PageErrorBoundary catches this throw.
      err => { pending = null; throw err },
    )
    return pending
  }
  registerPage(match, fetch)

  return function Page() {
    if (!mod) throw fetch()
    const Component = mod[name] as ComponentType
    return <Component />
  }
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

/**
 * The Chrome-on-Android address-bar tint. It isn't CSS, so it follows neither
 * [data-theme] nor the page on its own.
 *
 * Android only, despite the tag's name: iOS ignores theme-color for a
 * standalone web app's status bar (and ignores the manifest's theme_color
 * too) — there the only lever is apple-mobile-web-app-status-bar-style, now
 * black-translucent, which puts the page itself under the strip. Android in
 * `display: standalone` still paints its bar from this tag with the content
 * below it, so the colour still has to be matched by hand.
 *
 * And it has to be what the app actually paints along its top edge, which is
 * NOT --bg-primary: the strip sits directly above the AmbientBackground, whose
 * two brightest radial stops are anchored at the top of the screen. Measured
 * on a phone-width viewport the app's top row is #181e45 dark / #bfc5eb light
 * while this tag used to say #010102 — a flat black band above a violet app.
 *
 * One exception puts the flat --bg-primary under the strip instead, and reads
 * the -flat token: the screens that hide the ambient (the study/focus stack).
 *
 * Read from the store rather than a prop so every caller shares one
 * implementation.
 */
function syncThemeColor() {
  const el = document.documentElement
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) return
  const flat = useAppStore.getState().ambientHidden
  const token = flat ? '--theme-color-meta-flat' : '--theme-color-meta'
  const c = getComputedStyle(el).getPropertyValue(token).trim()
  if (c) meta.content = c
}

export function App() {
  // Atomic selectors, not `useAppStore()`. The selector-less form is identity
  // by default, and the state object's identity changes on every `set()` — so
  // App, which owns the ambient background, the router and the three app-level
  // hosts, was re-rendering on every card advance, every filter keystroke and
  // the `setAmbientHidden` that each navigation fires. Only `theme` is state
  // here; the four setters are stable, so those selectors never re-render.
  const theme = useAppStore(s => s.theme)
  const setInstallPrompt = useAppStore(s => s.setInstallPrompt)
  const setInstalled = useAppStore(s => s.setInstalled)
  const setSwUpdateAvailable = useAppStore(s => s.setSwUpdateAvailable)
  const setSwRegistration = useAppStore(s => s.setSwRegistration)
  const ambientHidden = useAppStore(s => s.ambientHidden)
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
      // setAttribute above has already invalidated style, and syncThemeColor's
      // getComputedStyle forces the recalc, so this reads the NEW theme's
      // value in the same tick.
      syncThemeColor()
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

  // Entering or leaving a focus screen swaps the ground under the status bar
  // from the ambient mesh to flat --bg-primary, so the band has to follow. The
  // theme effect above covers the theme half; this covers the other one.
  useEffect(() => {
    syncThemeColor()
  }, [ambientHidden])

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
