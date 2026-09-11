import { useEffect, useState } from 'react'
import { routeNumber } from '../../utils/packRoute'
import { PackMeta } from '../../types/vocabulary'
import './HerePill.css'

interface Props {
  frontier: PackMeta | null
  onJump: () => void
}

/**
 * "Jesteś tu, nr 317" — the way back to your own position.
 *
 * A route you can only walk by scrolling is a route you get lost on. Every
 * other way into the catalogue (a volume, a search hit, a lens) moves you away
 * from where you actually are, so there has to be exactly one control that
 * always brings you back.
 *
 * It only appears once the frontier node has actually left the viewport, so it
 * never covers the thing it points at.
 */
export function HerePill({ frontier, onJump }: Props) {
  const [away, setAway] = useState(false)

  useEffect(() => {
    if (!frontier) { setAway(false); return }

    let io: IntersectionObserver | null = null
    let raf = 0
    let tries = 0

    // The row may not exist yet — the snapshot resolves after this mounts, and
    // its volume has to expand first. Waiting for it (rather than assuming
    // "away") is what stops the pill from flashing over the very card it points
    // at on first paint.
    const attach = () => {
      const node = document.getElementById(`pack-${frontier.id}`)
      if (!node) {
        if (tries++ < 90) raf = requestAnimationFrame(attach)
        return
      }
      const root = document.querySelector('.appshell__main')
      io = new IntersectionObserver(
        entries => setAway(!entries[0]?.isIntersecting),
        { root: root ?? null, rootMargin: '-8% 0px -8% 0px' },
      )
      io.observe(node)
    }
    attach()

    return () => { cancelAnimationFrame(raf); io?.disconnect() }
  }, [frontier])

  if (!frontier || !away) return null

  return (
    <button className="herepill" onClick={onJump}>
      <span className="herepill__dot" aria-hidden="true" />
      <span className="herepill__text">
        Jesteś tu <span className="herepill__nr">nr</span>
        <strong>{routeNumber(frontier.id)}</strong>
      </span>
    </button>
  )
}
