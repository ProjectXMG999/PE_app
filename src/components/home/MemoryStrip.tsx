import { useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { PackMeta } from '../../types/vocabulary'
import { getPackIcon } from '../../utils/packVisuals'
import { plPacks, plural } from '../../utils/plural'
import { routeNumber, volumeShort } from '../../utils/packRoute'
import { EASE_OUT_EXPO } from '../today/motion'
import './MemoryStrip.css'

export interface FadingItem {
  pack: PackMeta
  /** Mean recall probability across the pack's known words, 0–1. */
  strength: number
}

interface Props {
  /** The packs that are actually slipping, most decayed first. */
  items: FadingItem[]
  /** Estimated minutes to go over every known word in those packs once. */
  minutes: number
  /** Jump the route to a pack (switches volume if needed). */
  onPick: (packId: string) => void
  /** Switch the page to the "Wraca do Ciebie" lens. */
  onShowAll: () => void
}

const OPEN_KEY = 'pe-memstrip-open'
/** Rows in the expanded list before handing off to the lens. */
const ROWS = 5
/** Emoji tiles stacked in the collapsed header. */
const FACES = 3

function readOpen(): boolean {
  try { return sessionStorage.getItem(OPEN_KEY) === '1' } catch { return false }
}

/**
 * "N paczek wraca do Ciebie" — which, how much, and what it would take.
 *
 * ── Why it collapses ─────────────────────────────────────────────────────────
 * It sits above the route on every visit. The previous version was ~240px of a
 * phone screen — title, CTA and a row of chips — before a single pack, for
 * something you act on occasionally. Collapsed it is one row that still says
 * the three things worth knowing at a glance: that something is slipping, what
 * (the faces of the weakest packs), and what it would cost to fix.
 *
 * ── Why the percentages ──────────────────────────────────────────────────────
 * `PackMemory.strength` is the FSRS recall probability averaged over a pack's
 * known words. It was computed for every pack and only ever used as a boolean
 * (`< 0.7`). Expanded, each row shows it as a bar, so "which one first" is
 * answered by length rather than by reading.
 *
 * ── The wording stays load-bearing ───────────────────────────────────────────
 * Nothing has been lost: `known` is permanent and the route count never goes
 * down. So this says the words are coming back around — never "tracisz" or
 * "zapominasz".
 *
 * Deliberately still NOT a link to /powtorka: that queue is ordered by FSRS
 * priority across every pack, so a button here would promise a session about
 * *these* packs that the review screen doesn't run. Doing something about it
 * today is Dzisiaj's job.
 */
export function MemoryStrip({ items, minutes, onPick, onShowAll }: Props) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(readOpen)
  if (items.length === 0) return null

  const n = items.length
  const faces = items.slice(0, FACES)
  const rows = items.slice(0, ROWS)

  const toggle = () => {
    setOpen(o => {
      try { sessionStorage.setItem(OPEN_KEY, o ? '0' : '1') } catch { /* private mode */ }
      return !o
    })
  }

  return (
    <section className={`memstrip${open ? ' is-open' : ''}`} aria-label="Paczki wracające do powtórki">
      <button
        type="button"
        className="memstrip__head"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="memstrip-list"
      >
        <span className="memstrip__faces" aria-hidden="true">
          {faces.map((it, i) => (
            <span key={it.pack.id} className="memstrip__face" style={{ '--i': i } as CSSProperties}>
              {getPackIcon(it.pack)}
            </span>
          ))}
        </span>

        <span className="memstrip__text">
          <span className="memstrip__title">
            <strong>{n}</strong> {plPacks(n)} {plural(n, 'wraca', 'wracają', 'wraca')} do Ciebie
          </span>
          <span className="memstrip__sub">
            ~{Math.max(1, minutes)} min, żeby je odświeżyć
          </span>
        </span>

        <svg className="memstrip__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="memstrip-list"
            className="memstrip__body"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.28, ease: EASE_OUT_EXPO }}
          >
            <ul className="memstrip__list">
              {rows.map(({ pack, strength }) => {
                const pct = Math.round(strength * 100)
                return (
                  <li key={pack.id}>
                    <button type="button" className="memstrip__row" onClick={() => onPick(pack.id)}>
                      <span className="memstrip__tile" aria-hidden="true">{getPackIcon(pack)}</span>
                      <span className="memstrip__row-text">
                        <span className="memstrip__row-name">{pack.name}</span>
                        <span className="memstrip__row-meta">
                          nr {routeNumber(pack.id)} · Tom {volumeShort(pack.volume)}
                        </span>
                      </span>
                      <span className="memstrip__recall" aria-label={`w pamięci około ${pct}%`}>
                        <span className="memstrip__recall-pct">{pct}%</span>
                        <span className="memstrip__recall-bar" aria-hidden="true">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <button type="button" className="memstrip__all" onClick={onShowAll}>
              {n > ROWS ? `Pokaż wszystkie ${n} na trasie` : 'Pokaż na trasie'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
