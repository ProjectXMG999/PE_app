import { SmartStep, SmartSegment } from '../../services/smartQueue'
import './SmartProgressRail.css'

interface Props {
  steps: SmartStep[]
  stepIndex: number
}

/**
 * One bar for the whole Inteligentny session, split into colored zones by
 * segment (learn/review/stretch) so the mix is visible at a glance, with a
 * single fill overlay showing how far in the current card is.
 *
 * No counter of its own: StudyStage's header carries "3 / 20" for every
 * session type, and two of them on one screen said the same thing twice.
 */
export function SmartProgressRail({ steps, stepIndex }: Props) {
  const cardSteps = steps.filter((s): s is Extract<SmartStep, { kind: 'card' }> => s.kind === 'card')
  const total = cardSteps.length
  const cardsBefore = steps.slice(0, stepIndex).filter(s => s.kind === 'card').length
  const pct = total > 0 ? (cardsBefore / total) * 100 : 0

  const zones: { segment: SmartSegment; count: number }[] = []
  for (const s of cardSteps) {
    const last = zones[zones.length - 1]
    if (last && last.segment === s.segment) last.count += 1
    else zones.push({ segment: s.segment, count: 1 })
  }

  return (
    <div className="smartrail" role="progressbar" aria-valuenow={cardsBefore} aria-valuemin={0} aria-valuemax={total}>
      <div className="smartrail__track">
        {zones.map((z, i) => (
          <span
            key={i}
            className={`smartrail__zone smartrail__zone--${z.segment}`}
            style={{ flexGrow: z.count }}
          />
        ))}
        <div className="smartrail__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
