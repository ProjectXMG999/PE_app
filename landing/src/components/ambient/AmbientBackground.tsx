import { Suspense, lazy, useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import './AmbientBackground.css'

/**
 * The atmosphere behind the whole page — the same slow WebGL mesh gradient
 * (Paper Shaders) with film grain and a floor vignette that the app runs, so a
 * visitor who signs up lands on a screen that already feels familiar.
 *
 * Two differences from the app's copy, both about it being a landing page:
 *
 *  1. The shader is LAZY. `.ambient` paints a CSS-gradient approximation of the
 *     same palette immediately, and the canvas cross-fades in once its chunk
 *     has loaded. The hero's LCP must never wait on a WebGL context — that was
 *     the whole reason this could be ported at all.
 *  2. Theme is hard-coded dark. There's no store and no theme toggle here.
 *
 *  • prefers-reduced-motion → a single static frame, no animation loop.
 *  • paused while the tab is hidden (battery).
 *  • pointer-events: none, z-index below everything.
 */
const MeshField = lazy(() => import('./MeshField'))

export function AmbientBackground() {
  const reduced = usePrefersReducedMotion()

  const [tabHidden, setTabHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Hold the shader back until the browser is otherwise idle. Mounting it in
  // the first frame competes with the hero's fonts and screenshot for both
  // network and main thread, which is exactly the tradeoff we're avoiding.
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

  return (
    <div className="ambient" aria-hidden="true">
      <div className={`ambient__field${armed ? ' ambient__field--ready' : ''}`}>
        {armed && (
          <Suspense fallback={null}>
            <MeshField still={reduced || tabHidden} />
          </Suspense>
        )}
      </div>
      <div className="ambient__grain" />
    </div>
  )
}
