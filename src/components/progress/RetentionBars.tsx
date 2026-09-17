import { ReactNode, useMemo, useState } from 'react'
import type { WordProgress } from '../../types/progress'
import { retentionBreakdown, type RetentionTier } from '../../services/reviewQueue'
import { RetentionInfoSheet } from './RetentionInfoSheet'
import { plural } from '../../utils/plural'
import './RetentionBars.css'

interface Props {
  wordProgress: WordProgress[]
  /** Rendered above the retention breakdown in the same card — Postęp puts the
   *  review queue here, so "what's due" and "how well it holds" read as one. */
  queue?: ReactNode
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
 *
 * Tier names are plain Polish ("Nowe", "Utrwalają się", "Dobrze znane"), not
 * the translated metaphors they started as ("Świeże", "Krzepnące", "Mocne").
 */
const TIER_META: Record<RetentionTier, TierMeta> = {
  fresh:   { label: 'Nowe',          color: '#F59E0B', cadence: 'co kilka dni' },
  setting: { label: 'Utrwalają się', color: '#84CC16', cadence: 'co 1–3 tygodnie' },
  solid:   { label: 'Utrwalone',     color: '#22C55E', cadence: 'co 1–2 miesiące' },
  strong:  { label: 'Dobrze znane',  color: '#14B8A6', cadence: 'co kilka miesięcy' },
  locked:  { label: 'Na stałe',      color: '#8B5CF6', cadence: 'raz w roku' },
}

export function RetentionBars({ wordProgress, queue }: Props) {
  const [infoOpen, setInfoOpen] = useState(false)
  const stats = useMemo(() => retentionBreakdown(wordProgress), [wordProgress])
  const { buckets, total, durablePct } = stats

  // The most populated tier — named in the summary when nothing is durable yet.
  const biggest = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0])

  return (
    <div className="retention u-liquid">
      {queue && (
        <>
          {queue}
          <hr className="retention__divider" />
          <h3 className="retention__part-title">Jak dobrze pamiętasz opanowane słowa</h3>
          <p className="retention__part-sub">Obok każdej grupy: jak często jej słowa wracają w powtórkach.</p>
        </>
      )}
      <div className="retention__head">
        <p className="retention__total">
          {total === 0
            ? 'Opanowane słowa'
            : `${total.toLocaleString('pl-PL')} ${plural(total, 'opanowane słowo', 'opanowane słowa', 'opanowanych słów')}`}
        </p>
        <button
          type="button"
          className="retention__info-btn"
          onClick={() => setInfoOpen(true)}
          aria-label="Skąd biorą się te grupy"
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
          Kiedy oznaczysz pierwsze słowa jako znane, zobaczysz tu, jak dobrze je pamiętasz.
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
                <strong>{durablePct}%</strong> słów pamiętasz już na miesiące albo dłużej. To zasługa
                powtórek robionych w coraz dłuższych odstępach.
              </>
            ) : durablePct > 0 ? (
              <>
                <strong>{durablePct}%</strong> słów masz już dobrze utrwalone. Pozostałe jeszcze się
                utrwalają. Im więcej poprawnych odpowiedzi w powtórkach, tym rzadziej będą wracać.
              </>
            ) : (
              <>
                Najwięcej słów jest teraz w grupie „{TIER_META[biggest.tier].label}”. Rób powtórki,
                kiedy się pojawią, a słowa będą przechodzić do kolejnych grup.
              </>
            )}
          </p>
        </>
      )}

      {infoOpen && <RetentionInfoSheet onClose={() => setInfoOpen(false)} />}
    </div>
  )
}
