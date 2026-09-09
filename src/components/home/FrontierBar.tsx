import { PackMeta } from '../../types/vocabulary'
import { routeNumber } from '../../utils/packRoute'
import './FrontierBar.css'

interface Props {
  frontier: PackMeta | null
  onJump: () => void
}

/**
 * "You are here" on the route — names the earliest unfinished pack and jumps the
 * list to it. Deliberately has no Słuchaj/Trenuj buttons: choosing the next
 * action is the Dzisiaj screen's job; this is just a bookmark into the map.
 */
export function FrontierBar({ frontier, onJump }: Props) {
  if (!frontier) return null
  return (
    <button type="button" className="frontierbar" onClick={onJump}>
      <span className="frontierbar__eyebrow">Jesteś tu</span>
      <span className="frontierbar__pack">
        <span className="frontierbar__num">#{routeNumber(frontier.id)}</span>
        <span className="frontierbar__name">{frontier.name}</span>
      </span>
      <span className="frontierbar__go" aria-hidden="true">→</span>
    </button>
  )
}
