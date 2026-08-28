import { useState } from 'react'
import { LEVEL_META } from '../../data/levels'
import { DAILY_GOAL_OPTIONS } from '../../store/useAppStore'
import './PaceSimulator.css'

interface Props {
  knownWords: number
  /** Words the user actually learns per minute of study, measured. */
  wordsPerMinute: number
  /** Their current real pace in words/day, for the "today" comparison. */
  currentWordsPerDay: number
}

function formatDuration(days: number): string {
  if (days <= 0) return 'osiągnięte'
  if (days < 60) return `${days} dni`
  const months = Math.round(days / 30)
  if (months < 24) return `${months} mies.`
  const years = (days / 365).toFixed(1).replace('.', ',')
  return `${years} lat`
}

/**
 * "What if I gave it twenty minutes instead of ten?"
 *
 * Not a chart — a question. Picking a longer daily commitment immediately
 * rewrites the arrival dates for every remaining level, which argues for
 * consistency far more concretely than any amount of copy about discipline.
 *
 * Deliberately built on the user's *own* measured words-per-minute rather than a
 * marketing figure, so the promise it makes is one they've already proven.
 */
export function PaceSimulator({ knownWords, wordsPerMinute, currentWordsPerDay }: Props) {
  const remaining = LEVEL_META.filter(l => l.threshold > knownWords)

  // The pill nearest what the user's own recent pace implies — used both as
  // the starting selection AND as the fixed "today" baseline below, so that
  // picking it back always reads as a no-op. `currentWordsPerDay` (recent
  // real throughput) and `wordsPerMinute` (lifetime words-known ÷ lifetime
  // minutes) are measured completely differently and can disagree wildly —
  // e.g. a past "mark all as known" tap inflates wordsPerMinute for good —
  // so comparing the chosen pill against currentWordsPerDay directly could
  // show the *default* pill as dramatically "ahead of itself". Comparing
  // every pill against this same rate-based baseline instead keeps the
  // whole simulator internally consistent regardless of that skew.
  const baselineMinutes = wordsPerMinute > 0
    ? DAILY_GOAL_OPTIONS.reduce((best, o) => {
        const implied = currentWordsPerDay / wordsPerMinute
        return Math.abs(o - implied) < Math.abs(best - implied) ? o : best
      })
    : 15
  const [minutes, setMinutes] = useState<number>(baselineMinutes)

  if (remaining.length === 0 || wordsPerMinute <= 0) return null

  const projected = wordsPerMinute * minutes
  const baseline = Math.max(wordsPerMinute * baselineMinutes, 0.1)

  return (
    <div className="pacesim">
      <p className="pacesim__lead">
        Gdybyś uczył się <strong>{minutes} minut dziennie</strong>, byłbyś tu:
      </p>

      <div className="pacesim__pills" role="group" aria-label="Minut dziennie">
        {DAILY_GOAL_OPTIONS.map(o => (
          <button
            key={o}
            type="button"
            className={`pacesim__pill${o === minutes ? ' pacesim__pill--active' : ''}`}
            onClick={() => setMinutes(o)}
            aria-pressed={o === minutes}
          >
            {o}
            <span className="pacesim__pill-unit">min</span>
          </button>
        ))}
      </div>

      <ul className="pacesim__rows">
        {remaining.map(l => {
          const need = l.threshold - knownWords
          const days = Math.ceil(need / projected)
          const nowDays = Math.ceil(need / baseline)
          const saved = nowDays - days
          return (
            <li key={l.level} className="pacesim__row">
              <span className="pacesim__row-name">{l.name}</span>
              <span className="pacesim__row-eta">{formatDuration(days)}</span>
              {saved > 6 && (
                <span className="pacesim__row-saved">
                  {formatDuration(saved)} wcześniej
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <p className="pacesim__foot">
        Twoje tempo: ok. {projected.toFixed(0)} opanowanych słów dziennie przy {minutes} min nauki.
      </p>
    </div>
  )
}
