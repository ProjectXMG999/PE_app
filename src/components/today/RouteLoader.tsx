import './RouteLoader.css'

interface Props {
  height?: number
}

/**
 * A branded stand-in for the generic shimmer skeleton, used only on /dzis
 * while snapshot/pulse are still loading — a short curved road segment with a
 * traveling dot, instead of a plain gray rectangle.
 */
export function RouteLoader({ height = 24 }: Props) {
  return (
    <div className="routeloader" style={{ height }} role="img" aria-label="Ładowanie">
      <svg viewBox="0 0 200 24" preserveAspectRatio="none" width="100%" height="100%">
        <path
          className="routeloader__track"
          d="M 4 20 C 50 4, 90 20, 130 10 S 180 4, 196 12"
          fill="none"
          stroke="var(--route-line)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          className="routeloader__sweep"
          d="M 4 20 C 50 4, 90 20, 130 10 S 180 4, 196 12"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={100}
        />
      </svg>
    </div>
  )
}
