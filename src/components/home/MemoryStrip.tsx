import { PackMeta } from '../../types/vocabulary'
import { plPacks } from '../../utils/packVisuals'
import { routeNumber } from '../../utils/packRoute'
import './MemoryStrip.css'

interface Props {
  /** The packs that are actually slipping, most decayed first. */
  packs: PackMeta[]
  /** Jump the route to a pack. */
  onPick: (packId: string) => void
  /** Switch the page to the "Wraca do Ciebie" lens. */
  onShowAll: () => void
}

/** Names shown inline before collapsing into "+N". */
const SHOWN = 4

/**
 * "N pakietów wraca do Ciebie" — and now, *which*.
 *
 * `fadingPacks()` has always returned the identifiers; the strip rendered only
 * `.length`. Knowing precisely which conquered ground is slipping and choosing
 * to show a bare count was the clearest case of the page holding back what it
 * already knew.
 *
 * The wording stays load-bearing. FSRS decay is honest information the product
 * promises to show, but nothing has been lost: `known` is permanent, badges
 * never un-earn, the route count never goes down. So this says the words are
 * coming back around — never "tracisz" or "zapominasz".
 *
 * Deliberately NOT a link to /powtorka. Which ground is slipping is a fact about
 * your territory and belongs here; doing something about it today is the Dzisiaj
 * screen's job, and it already has a review card that counts the same words.
 * Two entry points to one session is how this screen turned into a second
 * Dzisiaj last time.
 */
export function MemoryStrip({ packs, onPick, onShowAll }: Props) {
  if (packs.length === 0) return null
  const shown = packs.slice(0, SHOWN)
  const hidden = packs.length - shown.length

  return (
    <section className="memstrip" aria-label="Pakiety wracające do powtórki">
      {/* The whole header is the target, not the words "Pokaż na trasie" — on a
          phone that was a 12px line of text with no padding around it. A button
          can't nest one, so the CTA is a span and the row carries the tap. */}
      <button type="button" className="memstrip__head" onClick={onShowAll}>
        <span className="memstrip__dot" aria-hidden="true" />
        <span className="memstrip__title">
          <strong>{packs.length}</strong> {plPacks(packs.length)} wraca do Ciebie
        </span>
        <span className="memstrip__cta">
          Pokaż na trasie
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </button>

      <ul className="memstrip__list">
        {shown.map(p => (
          <li key={p.id}>
            <button type="button" className="memstrip__chip" onClick={() => onPick(p.id)}>
              <span className="memstrip__chip-num"><span className="memstrip__chip-nr">nr</span>{routeNumber(p.id)}</span>
              <span className="memstrip__chip-name">{p.name}</span>
            </button>
          </li>
        ))}
        {hidden > 0 && (
          <li>
            <button type="button" className="memstrip__more" onClick={onShowAll}>+{hidden}</button>
          </li>
        )}
      </ul>
    </section>
  )
}
