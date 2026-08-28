import { useMemo, useState } from 'react'
import type { WordProgress } from '../../types/progress'
import { retentionBreakdown, type RetentionTier } from '../../services/reviewQueue'
import { RetentionInfoSheet } from './RetentionInfoSheet'
import './RetentionBars.css'

interface Props {
  wordProgress: WordProgress[]
}

interface TierMeta {
  label: string
  color: string
  /** Plain-language cadence — the interval a word in this tier comes back at. */
  cadence: string
}

/**
 * How the user's mastered vocabulary is distributed across memory-strength
 * tiers — a segmented bar plus a legend.
 *
 * The scheduler already tracks per-word `stability` (how many days until recall
 * would fade to ~90%); until now that number never surfaced. Seeing "60% of your
 * words hold for months" is the payoff that makes the daily review grind legible.
 *
 * Colours run warm→cool as memory sets (amber = just learned, still slippery →
 * teal = holds for months); "Na stałe" breaks the ramp in the brand colour
 * because it's a different kind of state — out of rotation, not just strong.
 */
const TIER_META: Record<RetentionTier, TierMeta> = {
  fresh:   { label: 'Świeże',    color: '#F59E0B', cadence: 'wraca co kilka dni' },
  setting: { label: 'Krzepnące', color: '#84CC16', cadence: 'wraca co 1–3 tygodnie' },
  solid:   { label: 'Utrwalone', color: '#22C55E', cadence: 'wraca co 1–2 miesiące' },
  strong:  { label: 'Mocne',     color: '#14B8A6', cadence: 'wraca co kilka miesięcy' },
  locked:  { label: 'Na stałe',  color: '#8B5CF6', cadence: 'kontrolnie raz w roku' },
}

export function RetentionBars({ wordProgress }: Props) {
  const [infoOpen, setInfoOpen] = useState(false)
  const stats = useMemo(() => retentionBreakdown(wordProgress), [wordProgress])
  const { buckets, total, durablePct } = stats

  // The most populated tier — named in the summary when nothing is durable yet.
  const biggest = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0])

  return (
    <div className="retention">
      <div className="retention__head">
        <p className="retention__total">
          {total === 0
            ? 'Poziom zapamiętania'
            : `${total.toLocaleString('pl-PL')} ${total === 1 ? 'opanowane słowo' : 'opanowanych słów'}`}
        </p>
        <button
          type="button"
          className="retention__info-btn"
          onClick={() => setInfoOpen(true)}
          aria-label="Jak działa poziom zapamiętania"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="11" x2="12" y2="16" />
            <circle cx="12" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      {total === 0 ? (
        <p className="retention__empty">
          Gdy zaczniesz oznaczać słowa jako znane, zobaczysz tu, jak mocno trzymają się
          w pamięci — od świeżo poznanych po utrwalone na stałe.
        </p>
      ) : (
        <>
          <div
            className="retention__bar"
            role="img"
            aria-label={
              buckets
                .filter(b => b.count > 0)
                .map(b => `${TIER_META[b.tier].label}: ${b.count}`)
                .join(', ')
            }
          >
            {buckets.map(b =>
              b.count === 0 ? null : (
                <span
                  key={b.tier}
                  className="retention__seg"
                  style={{
                    width: `${(b.count / total) * 100}%`,
                    background: TIER_META[b.tier].color,
                  }}
                />
              )
            )}
          </div>

          <dl className="retention__legend">
            {buckets.map(b => {
              const meta = TIER_META[b.tier]
              const pct = Math.round((b.count / total) * 100)
              return (
                <div
                  key={b.tier}
                  className={`retention__row${b.count === 0 ? ' retention__row--empty' : ''}`}
                >
                  <dt className="retention__term">
                    <span
                      className="retention__dot"
                      style={{ background: meta.color }}
                      aria-hidden="true"
                    />
                    {meta.label}
                  </dt>
                  <dd className="retention__val">
                    <span className="retention__count">{b.count}</span>
                    <span className="retention__pct">{pct}%</span>
                    <span className="retention__cadence">{meta.cadence}</span>
                  </dd>
                </div>
              )
            })}
          </dl>

          <p className="retention__summary">
            {durablePct >= 50 ? (
              <>
                <strong>{durablePct}%</strong> Twojego słownictwa utrzymuje się w pamięci przez
                miesiące lub dłużej — to efekt powtórek w coraz większych odstępach.
              </>
            ) : durablePct > 0 ? (
              <>
                <strong>{durablePct}%</strong> słów masz już mocno utrwalone. Reszta wciąż się
                utrwala — im częściej ją poprawnie powtarzasz, tym rzadziej wraca.
              </>
            ) : (
              <>
                Najwięcej Twoich słów jest na etapie „{TIER_META[biggest.tier].label.toLowerCase()}”.
                Rób powtórki, gdy słowa pojawią się do zrobienia — z czasem awansują wyżej.
              </>
            )}
          </p>
        </>
      )}

      {infoOpen && <RetentionInfoSheet onClose={() => setInfoOpen(false)} />}
    </div>
  )
}
