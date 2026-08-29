import { useRef } from 'react'
import './AmbientBackground.css'

// Durations must match the @keyframes in AmbientBackground.css.
const BLOOM_A_MS = 19000
const BLOOM_B_MS = 24000
const BLOOM_B_OFFSET_MS = 8000 // the visual stagger the two blooms used to get from a CSS animation-delay: -8s
const SHINE_MS = 7000

/**
 * Purely decorative — two slow-drifting color blooms plus a faint route
 * watermark, sat behind the page content. The route path is an abstraction of
 * the same "map" motif drawn functionally by RouteStrip/RouteMap, just here as
 * atmosphere rather than data.
 *
 * Lives in AppShell, so it unmounts and remounts on every route change (each
 * page renders its own <AppShell>, not a shared layout route) — without help
 * the CSS loops would visibly snap back to their start on every navigation.
 * Anchoring each animation's delay to wall-clock time at mount, instead of
 * always starting at 0, makes a fresh mount pick up mid-cycle at roughly the
 * point it would already be at, so it reads as continuous rather than
 * restarting.
 */
export function AmbientBackground() {
  const mountedAt = useRef(Date.now())

  const bloomADelay = -(mountedAt.current % BLOOM_A_MS)
  const bloomBDelay = -((mountedAt.current + BLOOM_B_OFFSET_MS) % BLOOM_B_MS)
  const shineDelay = -(mountedAt.current % SHINE_MS)

  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient__bloom ambient__bloom--a" style={{ animationDelay: `${bloomADelay}ms` }} />
      <div className="ambient__bloom ambient__bloom--b" style={{ animationDelay: `${bloomBDelay}ms` }} />
      <svg className="ambient__route" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <path
          className="ambient__route-line"
          d="M -20 620 C 80 560, 120 480, 90 400 S 260 260, 220 160 S 420 60, 460 -20"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* A short bright segment travelling the same path, on a loop — the
            "polish"/gleam that makes the watermark feel alive rather than
            just a static line. `pathLength` normalizes dash math to 0-100
            regardless of the curve's real length. */}
        <path
          className="ambient__route-shine"
          d="M -20 620 C 80 560, 120 480, 90 400 S 260 260, 220 160 S 420 60, 460 -20"
          fill="none"
          stroke="var(--accent-bright)"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          style={{ animationDelay: `${shineDelay}ms` }}
        />
      </svg>
    </div>
  )
}
