import { ReactNode, useMemo, useState } from 'react'
import type { WordProgress } from '../../types/progress'
import { retentionBreakdown, type RetentionTier } from '../../services/reviewQueue'
import { RetentionInfoSheet } from './RetentionInfoSheet'
import { FlowNumber } from '../shared/FlowNumber'
import { useRevealOnView } from '../../hooks/useRevealOnView'
import { plural, plWords } from '../../utils/plural'
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
  // Deep maintenance is capped at FSRS_MAX_INTERVAL (730 days), so "raz w roku"
  // was the floor of the range quoted as the whole of it.
  locked:  { label: 'Na stałe',      color: '#8B5CF6', cadence: 'raz na rok albo dwa' },
}

/** Grey, and outside the warm→cool ramp on purpose: declared words aren't a
 *  stage of memory the others lead to, they're vocabulary that never entered
 *  the scale. */
const DECLARED_COLOR = '#94A3B8'

/** The same grey family, one step darker: words the learner said they already
 *  knew the first time the app showed them. They DO have a schedule (unlike
 *  declared words), but nothing has been measured yet, so they sit outside the
 *  ramp too — until the first review, when they join a real tier. */
const ASSERTED_COLOR = '#64748B'

/**
 * Shares that add up to 100 — largest remainder, and never a bare "0%" beside a
 * non-zero count. Plain `Math.round` per row printed "49 · 0%" three times over
 * and made the column sum to 99, which reads as a broken screen rather than as
 * rounding.
 */
function sharePcts(counts: number[], total: number): string[] {
  if (total <= 0) return counts.map(() => '0%')
  const exact = counts.map(c => (c / total) * 100)
  const out = exact.map(Math.floor)
  let left = 100 - out.reduce((a, b) => a + b, 0)
  const byRemainder = exact
    .map((v, i) => ({ rem: v - Math.floor(v), i }))
    .sort((a, b) => b.rem - a.rem)
  for (const { i } of byRemainder) {
    if (left <= 0) break
    out[i]++
    left--
  }
  return out.map((p, i) => (p === 0 && counts[i] > 0 ? '<1%' : `${p}%`))
}

export function RetentionBars({ wordProgress, queue }: Props) {
  const [infoOpen, setInfoOpen] = useState(false)
  const [barRef, barShown] = useRevealOnView<HTMLDivElement>()
  const stats = useMemo(() => retentionBreakdown(wordProgress), [wordProgress])
  const { buckets, total, durablePct, declared, asserted } = stats
  const pcts = useMemo(() => sharePcts(buckets.map(b => b.count), total), [buckets, total])

  // The most populated tier — named in the summary when nothing is durable yet.
  const biggest = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0])

  // Words the learner declared known are real vocabulary, so they belong on the
  // card — but not inside the bar. They carry no measured memory strength and
  // no next review date, so they'd sit in a tier they never climbed to, under a
  // cadence they'll never come back at.
  const declaredLine = declared > 0 && (
    <div className="retention__declared">
      <span className="retention__dot" style={{ background: DECLARED_COLOR }} aria-hidden="true" />
      <span className="retention__declared-label">Oznaczone jako znane</span>
      <span className="retention__count">
        <FlowNumber value={declared} onView delayMs={360} />
      </span>
    </div>
  )

  const declaredNote = declared > 0 && (
    <p className="retention__summary retention__summary--declared">
      {declared === 1 ? 'Jedno słowo masz oznaczone' : `${declared.toLocaleString('pl-PL')} ${plural(declared, 'słowo masz oznaczone', 'słowa masz oznaczone', 'słów masz oznaczonych')}`}{' '}
      jako znane — to słownictwo, które przyniosłeś spoza aplikacji. Nie wraca w powtórkach
      i nie liczy się do tempa nauki, ale liczy się do Twojego słownictwa.
    </p>
  )

  // Words the learner knew before the app taught them. They have a real date —
  // a long one — but nothing has been measured yet, so they can't be shown in a
  // tier: a single tap is not "Dobrze znane · co kilka miesięcy". They move into
  // the bar the moment that first review confirms them.
  const assertedLine = asserted > 0 && (
    <div className="retention__declared">
      <span className="retention__dot" style={{ background: ASSERTED_COLOR }} aria-hidden="true" />
      <span className="retention__declared-label">Znane od pierwszego razu</span>
      <span className="retention__count">
        <FlowNumber value={asserted} onView delayMs={400} />
      </span>
    </div>
  )

  // Two whole sentences rather than one with slots: the count governs the verb
  // twice over ("wróci/wrócą", "pokaże/pokażą") and the pronoun once ("go/ich"),
  // and stitching those in turns the note into a puzzle for the next reader.
  const assertedNote = asserted > 0 && (
    <p className="retention__summary retention__summary--declared">
      {asserted === 1 ? (
        <>
          Jedno słowo znałeś już przy pierwszym pokazaniu. Wróci dopiero za kilka miesięcy —
          i dopiero ta powtórka pokaże, jak dobrze je pamiętasz, więc na razie nie ma go
          w grupach wyżej.
        </>
      ) : (
        <>
          {asserted.toLocaleString('pl-PL')}{' '}
          {plural(asserted, 'słowo znałeś', 'słowa znałeś', 'słów znałeś')} już przy pierwszym
          pokazaniu. Wrócą dopiero za kilka miesięcy — i dopiero te powtórki pokażą, jak dobrze
          je pamiętasz, więc na razie nie ma ich w grupach wyżej.
        </>
      )}
    </p>
  )

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
            : declared > 0 || asserted > 0
              // Scoped once there's a second population on the card, so the
              // number here can't be read as the whole vocabulary — that figure
              // lives on Statystyki and is the populations added together.
              // "w grupach" and not "w powtórkach": asserted words are in the
              // review queue too, they just aren't in a tier yet.
              ? `${total.toLocaleString('pl-PL')} ${plWords(total)} w grupach`
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
        <>
          <p className="retention__empty">
            {asserted > 0
              ? 'Te słowa czekają na pierwszą powtórkę — dopiero ona pokaże, jak dobrze je pamiętasz. Wtedy pojawią się tu grupy.'
              : declared > 0
                ? 'Całe Twoje słownictwo jest oznaczone jako znane, więc nie ma tu jeszcze czego mierzyć. Grupy pojawią się, kiedy zaczniesz robić powtórki.'
                : 'Kiedy oznaczysz pierwsze słowa jako znane, zobaczysz tu, jak dobrze je pamiętasz.'}
          </p>
          {assertedLine}
          {declaredLine}
          {assertedNote}
          {declaredNote}
        </>
      ) : (
        <>
          {/* The stacked bar assembles itself when you reach it — every
              segment already had a 700ms width transition that could never
              run, because the bar mounted at its final proportions. */}
          <div
            ref={barRef}
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
                    width: barShown ? `${(b.count / total) * 100}%` : 0,
                    background: TIER_META[b.tier].color,
                  }}
                />
              )
            )}
          </div>

          <dl className="retention__legend">
            {buckets.map((b, i) => {
              const meta = TIER_META[b.tier]
              const pct = pcts[i]
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
                    <span className="retention__count">
                      <FlowNumber value={b.count} onView delayMs={Math.min(i, 5) * 60} />
                    </span>
                    <span className="retention__pct">{pct}</span>
                    <span className="retention__cadence">{meta.cadence}</span>
                  </dd>
                </div>
              )
            })}
          </dl>

          {assertedLine}
          {declaredLine}

          <p className="retention__summary">
            {/* "z nich" and not "słów": with a declared population on the card
                the bare noun would claim the whole vocabulary, and this share is
                only ever about the words the app has actually measured. */}
            {durablePct >= 50 ? (
              <>
                <strong>{durablePct}%</strong> z nich pamiętasz już na miesiące albo dłużej. To zasługa
                powtórek robionych w coraz dłuższych odstępach.
              </>
            ) : durablePct > 0 ? (
              <>
                <strong>{durablePct}%</strong> z nich masz już dobrze utrwalone. Pozostałe jeszcze się
                utrwalają. Im więcej poprawnych odpowiedzi w powtórkach, tym rzadziej będą wracać.
              </>
            ) : (
              <>
                Najwięcej z nich jest teraz w grupie „{TIER_META[biggest.tier].label}”. Rób powtórki,
                kiedy się pojawią, a słowa będą przechodzić do kolejnych grup.
              </>
            )}
          </p>

          {assertedNote}
          {declaredNote}
        </>
      )}

      {infoOpen && <RetentionInfoSheet onClose={() => setInfoOpen(false)} />}
    </div>
  )
}
