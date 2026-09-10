import { Link } from 'react-router-dom'
import { plPacks } from '../../utils/packVisuals'
import './MemoryStrip.css'

interface Props {
  count: number
}

/**
 * "N pakietów wraca do Ciebie" — the one place in the app that says *which*
 * conquered ground is slipping.
 *
 * The wording is load-bearing. FSRS decay is honest information the product
 * promises to show ("pokazuj postęp uczciwie"), but the user has not lost
 * anything: `known` is permanent, badges never un-earn, the route count never
 * goes down. So this never says "tracisz" or "zapominasz" — it says the words
 * are coming back around.
 */
export function MemoryStrip({ count }: Props) {
  if (count <= 0) return null
  return (
    <Link to="/powtorka" className="memstrip" viewTransition>
      <span className="memstrip__dot" aria-hidden="true" />
      <span className="memstrip__text">
        <strong>{count}</strong> {plPacks(count)} wraca do Ciebie
      </span>
      <span className="memstrip__cta">Powtórz →</span>
    </Link>
  )
}
