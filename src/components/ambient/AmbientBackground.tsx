import { Suspense, lazy, useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import './AmbientBackground.css'

/**
 * The atmosphere behind every page: a slow WebGL mesh gradient (Paper Shaders)
 * under film grain and a floor vignette.
 *
 * This is the landing page's background, brought into the product — same
 * shader, same parameters, same grain — so a visitor who signs up lands on a
 * screen that already feels familiar. Three things it adds that the landing
 * doesn't need:
 *
 *  1. **Theme.** The five mesh stops come from the --mesh-* tokens rather than
 *     being hard-coded, and are re-read when <html data-theme> flips. Light
 *     theme gets its own palette, not the dark one dimmed.
 *  2. **Pausing.** Focus/session screens (flashcards, autoplay, review) set
 *     `ambientHidden` in the store; the element fades and the shader unmounts
 *     entirely, so a study session doesn't share the GPU with a backdrop.
 *  3. **A flat floor.** `.ambient` paints a CSS approximation of the same
 *     palette immediately and keeps it forever on devices that can't run WebGL.
 *
 * Mounted ONCE at the app root (App.tsx), above <Routes> — not per-page inside
 * AppShell. Each page renders its own <AppShell>, so anything living inside it
 * is torn down and rebuilt on every navigation, and for a looping shader (and
 * its GPU context) that's a visible restart.
 *
 * NOTE: this is a fixed layer at z-index -1, which only stays visible because
 * #root isolates (see global.css). Without that it paints under `body`'s own
 * background and the app goes flat black.
 */
const MeshField = lazy(() => import('./MeshField'))

const MESH_TOKENS = ['--mesh-1', '--mesh-2', '--mesh-3', '--mesh-4', '--mesh-5']

/** Used if the tokens can't be read — the dark palette, so a failure looks like
 *  the app rather than like a bug. */
const FALLBACK_COLORS = ['#080612', '#1a1442', '#241155', '#081a2c', '#080612']

function readMeshColors(): string[] {
  const cs = getComputedStyle(document.documentElement)
  const colors = MESH_TOKENS.map(t => cs.getPropertyValue(t).trim())
  return colors.every(Boolean) ? colors : FALLBACK_COLORS
}

export function AmbientBackground() {
  const ambientHidden = useAppStore(s => s.ambientHidden)
  const reduced = useReducedMotion()

  const [tabHidden, setTabHidden] = useState(() => document.hidden)
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Hold the shader back until the browser is otherwise idle. Mounting it in
  // the first frame competes with fonts, the pack index and the first route's
  // chunk for both network and main thread — and the CSS floor below already
  // looks like the finished thing while we wait.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const idle = window.requestIdleCallback
    if (idle) {
      const id = idle(() => setArmed(true), { timeout: 2500 })
      return () => window.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(() => setArmed(true), 1200)
    return () => window.clearTimeout(id)
  }, [])

  // Watch the attribute rather than the store's `theme`: in 'system' mode the
  // preference only resolves to a concrete theme inside App.tsx's effect, and
  // data-theme on <html> is where that lands. This also picks up the pre-paint
  // theme written by the inline script in index.html.
  const [colors, setColors] = useState<string[]>(readMeshColors)
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readMeshColors()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // Unmounted, not just faded: a session screen should leave no shader running.
  const showShader = armed && !ambientHidden

  return (
    <div className={`ambient${ambientHidden ? ' ambient--hidden' : ''}`} aria-hidden="true">
      <div className={`ambient__field${showShader ? ' ambient__field--ready' : ''}`}>
        {showShader && (
          <Suspense fallback={null}>
            <MeshField colors={colors} still={!!reduced || tabHidden} />
          </Suspense>
        )}
      </div>
      <div className="ambient__grain" />
    </div>
  )
}
