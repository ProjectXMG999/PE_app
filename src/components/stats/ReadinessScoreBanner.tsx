import { useReadinessScore } from '../../hooks/useReadinessScore'
import './ReadinessScoreBanner.css'

export function ReadinessScoreBanner() {
  const result = useReadinessScore()

  if (result === undefined) {
    return <div className="readiness-banner readiness-banner--skeleton skeleton" />
  }

  if (result === null) {
    return (
      <div className="readiness-banner readiness-banner--empty">
        <span className="readiness-banner__empty-icon">🎯</span>
        <p className="readiness-banner__empty-text">
          Ucz się przez kilka dni, żeby zobaczyć swoją gotowość do mówienia.
        </p>
      </div>
    )
  }

  const { score } = result

  return (
    <div className="readiness-banner">
      <div
        className="readiness-banner__ring"
        style={{ ['--readiness-pct' as string]: `${score}%` }}
      >
        <span className="readiness-banner__ring-value">{score}%</span>
      </div>
      <div className="readiness-banner__text">
        <span className="readiness-banner__eyebrow">Dziś</span>
        <span className="readiness-banner__title">Twoja gotowość do mówienia</span>
      </div>
    </div>
  )
}
