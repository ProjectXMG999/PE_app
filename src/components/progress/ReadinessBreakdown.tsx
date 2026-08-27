import { useState } from 'react'
import { ReadinessResult } from '../../hooks/useReadinessScore'
import { ReadinessInfoSheet } from './ReadinessInfoSheet'
import './ReadinessBreakdown.css'

interface Props {
  result: ReadinessResult
}

/**
 * The five parts behind the speaking-readiness score.
 *
 * The breakdown was already being computed and then thrown away — only the
 * single blended number reached the screen. A lone "68 %" tells you nothing you
 * can act on; the parts tell you exactly which lever to pull, which is the whole
 * point of a score that claims to be diagnostic.
 */
const PARTS: { key: keyof ReadinessResult['breakdown']; label: string; icon: string; hint: string }[] = [
  { key: 'swiezosc',    label: 'Świeżość',    icon: '🌿', hint: 'jak dawno był ostatni trening' },
  { key: 'retencja',    label: 'Retencja',    icon: '🧠', hint: 'ile z widzianych słów zostaje' },
  { key: 'regularnosc', label: 'Regularność', icon: '🔥', hint: 'seria dni z rzędu' },
  { key: 'mowienie',    label: 'Mówienie',    icon: '🗣️', hint: 'udział trybu mówienia' },
  { key: 'skutecznosc', label: 'Skuteczność', icon: '⚡', hint: 'tempo vs Twój rekord' },
]

function toneFor(v: number): string {
  if (v >= 70) return 'good'
  if (v >= 40) return 'mid'
  return 'low'
}

export function ReadinessBreakdown({ result }: Props) {
  const { score, breakdown } = result
  const [infoOpen, setInfoOpen] = useState(false)
  // The lowest part is the one worth naming — it's where the score is leaking.
  const weakest = PARTS.reduce((min, p) =>
    breakdown[p.key] < breakdown[min.key] ? p : min
  , PARTS[0])

  return (
    <div className="readiness">
      {/* Explains what each of the five parts (and the blended score) actually
          measures — a learner has no way to reverse-engineer, say, why
          Mówienie can read 0% while Skuteczność reads 100% without this. */}
      <button
        type="button"
        className="readiness__info-btn"
        onClick={() => setInfoOpen(true)}
        aria-label="Jak liczymy gotowość do mówienia"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="11" x2="12" y2="16" />
          <circle cx="12" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <div className="readiness__head">
        <div
          className="readiness__ring"
          style={{ ['--readiness-pct' as string]: `${score}%` }}
          role="img"
          aria-label={`Gotowość do mówienia: ${score} procent`}
        >
          <span className="readiness__ring-value">{score}%</span>
        </div>
        <div className="readiness__head-text">
          <h3 className="readiness__title">Gotowość do mówienia</h3>
          <p className="readiness__sub">
            Najsłabsze ogniwo: <strong>{weakest.label.toLowerCase()}</strong> — {weakest.hint}.
          </p>
        </div>
      </div>

      <dl className="readiness__parts">
        {PARTS.map(p => {
          const v = breakdown[p.key]
          return (
            <div key={p.key} className="readiness__part">
              <dt className="readiness__part-label">
                <span className="readiness__part-icon" aria-hidden="true">{p.icon}</span>
                {p.label}
              </dt>
              <dd className="readiness__part-value">
                <span className="readiness__bar">
                  <span
                    className={`readiness__bar-fill readiness__bar-fill--${toneFor(v)}`}
                    style={{ width: `${v}%` }}
                  />
                </span>
                <span className="readiness__pct">{v}%</span>
              </dd>
            </div>
          )
        })}
      </dl>

      {infoOpen && <ReadinessInfoSheet onClose={() => setInfoOpen(false)} />}
    </div>
  )
}
