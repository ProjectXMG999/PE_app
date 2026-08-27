import { LEVEL_META, LEVEL_COLORS, MARKER_STEP, ROUTE_TOTAL, nextMarkerInfo } from '../../data/levels'
import './RouteMap.css'

interface Props {
  knownWords: number
  /** ISO date each level was reached, keyed by level number, when known. */
  reachedAt?: Record<number, string | undefined>
}

interface Station {
  level: number
  name: string
  promise: string
  threshold: number
  color: string
  state: 'passed' | 'current' | 'ahead'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

/**
 * The route, drawn as a road with the four levels as stations along it.
 *
 * Three things this is doing that a progress bar can't:
 *  - the road *ahead* stays visible, dashed and dimmed, because "you can see how
 *    far you've come" only lands if you can also see where you're going;
 *  - the segment you're on carries 100-word markers, turning the abstract gap to
 *    the next level into a target that's a few days away rather than months;
 *  - each station says what it lets you *do*, not just how many words it costs.
 */
export function RouteMap({ knownWords, reachedAt = {} }: Props) {
  const stations: Station[] = LEVEL_META.map(l => ({
    level: l.level,
    name: l.name,
    promise: l.promise,
    threshold: l.threshold,
    color: LEVEL_COLORS[l.level] ?? 'var(--accent)',
    state: knownWords >= l.threshold ? 'passed' : 'ahead',
  }))

  // The current segment runs from the last station passed to the next one.
  const nextIndex = stations.findIndex(s => s.state === 'ahead')
  if (nextIndex >= 0) stations[nextIndex].state = 'current'

  const prevThreshold = nextIndex > 0 ? stations[nextIndex - 1].threshold : 0
  const nextThreshold = nextIndex >= 0 ? stations[nextIndex].threshold : ROUTE_TOTAL
  const span = Math.max(1, nextThreshold - prevThreshold)
  const segmentPct = Math.min(100, Math.max(0, ((knownWords - prevThreshold) / span) * 100))

  // Next 100-word marker — the nearest small win.
  const { nextMarker, toMarker, markerReached } = nextMarkerInfo(knownWords)

  const finished = nextIndex < 0

  return (
    <ol className="routemap" aria-label="Etapy trasy">
      {stations.map((s, i) => {
        const showYou = s.state === 'current'
        return (
          <li
            key={s.level}
            className={`routemap__item routemap__item--${s.state}`}
            style={{
              ['--station-color' as string]: s.color,
              animationDelay: `${i * 70}ms`,
            }}
          >
            <div className="routemap__rail" aria-hidden="true">
              <span className="routemap__dot" />
              {i < stations.length - 1 && <span className="routemap__line" />}
            </div>

            <div className="routemap__body">
              <div className="routemap__head">
                <h3 className="routemap__name">{s.name}</h3>
                <span className="routemap__threshold">
                  {s.threshold.toLocaleString('pl-PL')}
                </span>
              </div>
              <p className="routemap__promise">{s.promise}</p>

              {s.state === 'passed' && (
                <p className="routemap__status routemap__status--passed">
                  ✓ zdobyte{reachedAt[s.level] ? ` · ${formatDate(reachedAt[s.level]!)}` : ''}
                </p>
              )}

              {showYou && (
                <div className="routemap__you">
                  <div className="routemap__segment">
                    <div
                      className="routemap__segment-fill"
                      style={{ width: `${segmentPct}%` }}
                    />
                    <span
                      className="routemap__segment-marker"
                      style={{ left: `${segmentPct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="routemap__you-label">
                    <strong>Jesteś tu · {knownWords.toLocaleString('pl-PL')}</strong>
                    <span className="routemap__you-remaining">
                      {(s.threshold - knownWords).toLocaleString('pl-PL')} do celu
                    </span>
                  </p>
                  <p className="routemap__marker-hint">
                    <span className="routemap__marker-dots" aria-hidden="true">
                      {Array.from({ length: 10 }).map((_, d) => (
                        <span
                          key={d}
                          className={`routemap__marker-dot${
                            d < Math.round(markerReached / (MARKER_STEP / 10))
                              ? ' routemap__marker-dot--on'
                              : ''
                          }`}
                        />
                      ))}
                    </span>
                    ▸ jeszcze <strong>{toMarker}</strong> do znacznika{' '}
                    {nextMarker.toLocaleString('pl-PL')}
                  </p>
                </div>
              )}
            </div>
          </li>
        )
      })}

      {finished && (
        <li className="routemap__item routemap__item--finished">
          <div className="routemap__rail" aria-hidden="true">
            <span className="routemap__dot" />
          </div>
          <div className="routemap__body">
            <h3 className="routemap__name">Cała trasa za Tobą</h3>
            <p className="routemap__promise">
              10 000 słów. Stąd angielski jest już tylko narzędziem.
            </p>
          </div>
        </li>
      )}
    </ol>
  )
}
