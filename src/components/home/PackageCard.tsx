import { MouseEvent, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppNavigate } from '../../navigation/navigation'
import { armMorph } from '../../navigation/transitions'
import { preloadPath } from '../../navigation/pageChunks'
import { PackMeta } from '../../types/vocabulary'
import { useAuthStore } from '../../store/useAuthStore'
import { usePackWords } from '../../hooks/usePackWords'
import { routeNumber } from '../../utils/packRoute'
import { PackMemory } from '../../utils/packMemory'
import { getCategoryColor, getPackIcon } from '../../utils/packVisuals'
import './PackageCard.css'

interface Props {
  pack: PackMeta
  memory?: PackMemory
  /** How far Słuchaj has played through this pack, 0–100. */
  heardPct?: number
  /** The earliest pack on the route that isn't fully mastered. */
  isFrontier?: boolean
  /** Route number of the pack immediately before this one — for the "why now". */
  prevNum?: number
  /** Position in the rendered run, for the entrance stagger. */
  index?: number
}

/** relation → the word shown on the card and the class that colours it. */
const RELATION_META: Record<PackMemory['relation'], { label: string; cls: string }> = {
  sealed: { label: 'Na stałe',        cls: 'is-sealed' },
  held:   { label: 'Opanowane',       cls: 'is-held' },
  fading: { label: 'Wraca do Ciebie', cls: 'is-fading' },
  active: { label: 'W toku',          cls: 'is-active' },
  ahead:  { label: '',                cls: 'is-ahead' },
}

/**
 * One pack, as a row on the route.
 *
 * ── The mark carries two facts, not one ─────────────────────────────────────
 * The hand-picked emoji from `PACK_NAME_ICONS` answers "what is this pack
 * about" instantly; the route number answers "which of 864 is it", which is the
 * product's central claim. Picking one over the other loses real information,
 * so the mark stacks both — emoji in the tile, number underneath.
 *
 * ── Three axes of state, two rings around the tile ──────────────────────────
 * A pack is not one bar's worth of progress, and burying that in a line of
 * text per axis would make 864 rows unreadable. So it reads as two concentric
 * rings around the emoji, the same pattern Apple's Activity rings made
 * universally legible — a proven answer to exactly this problem, "several
 * independent measures, glanceable on one small dial":
 *
 *   outer ring   → Trenuj: mastery %, filled clockwise, coloured by memory
 *                  state (violet mid-route, gold once held or sealed, amber
 *                  while fading) — one ring, two facts at once.
 *   inner ring   → Słuchaj: how far playback has gotten through the pack.
 *
 * Both rings keep a dim, always-visible track under the filled arc — an
 * earlier pass drew the *remainder* as fully transparent, so an untouched
 * pack (most of the catalogue) showed no ring at all. A ring you can't see
 * on 90% of rows isn't legible; it's absent.
 *
 * Recall probability (the third memory fact) surfaces as text only while a
 * pack is actually slipping — `PackMemory.strength` was computed for all 864
 * packs on every render before this and reduced to a single boolean.
 *
 * ── Why one action ──────────────────────────────────────────────────────────
 * Two buttons on 864 rows is the Dzisiaj screen smeared across the catalogue.
 * The card opens the pack; both modes live there.
 */
export function PackageCard({ pack, memory, heardPct = 0, isFrontier, prevNum, index = 0 }: Props) {
  const navigate = useNavigate()
  const openFlow = useAppNavigate()
  // Atomic selectors, not `useAuthStore()`. Selector-less is identity, and the
  // state object's identity changes on every `set()` — on /pakiety that is 864
  // cards re-rendering because something unrelated touched the auth store.
  //
  // The second one selects the STATUS, not the `hasAccess` action: the action
  // is a stable reference that reads the status through `get()`, so subscribing
  // to it would leave every card showing a stale lock when entitlement finally
  // resolves. Same rule as the store's own (useAuthStore.ts:26), read where a
  // change to it can be seen.
  const user = useAuthStore(s => s.user)
  const hasAccess = useAuthStore(s => s.entitlementStatus === 'active')
  const iconRef = useRef<HTMLSpanElement>(null)
  const nameRef = useRef<HTMLSpanElement>(null)

  const words = usePackWords(pack.id)
  const relation = memory?.relation ?? 'ahead'
  const meta = RELATION_META[relation]
  const known = memory?.known ?? 0
  const total = memory?.total ?? pack.wordCount
  const knownPct = total > 0 ? Math.min(100, Math.round((known / total) * 100)) : 0
  const num = routeNumber(pack.id)
  const icon = getPackIcon(pack)
  // Only shown while slipping: at full strength it is noise, and on an untouched
  // pack it would be a claim about memory that doesn't exist yet.
  const recall = relation === 'fading' && memory ? Math.round(memory.strength * 100) : null

  // Mirror RequireEntitlement: logged-out visitors go to login, logged-in but
  // unentitled ones go to the account page.
  function open(e: MouseEvent) {
    e.preventDefault()
    if (!hasAccess) {
      navigate(user ? '/konto' : '/logowanie', user ? undefined : { state: { returnTo: `/pakiet/${pack.id}` } })
      return
    }
    // The row opens *into* the pack page: its emoji and its name travel to the
    // header of the page being opened, so the two screens read as one object
    // unfolding rather than two layouts swapping.
    //
    // Named only for the click that's actually navigating, and only for as long
    // as the transition lasts. A view transition costs per named element, and
    // this list is 864 rows — naming them up front would tax every navigation
    // in the app for the sake of the one row that gets tapped.
    for (const [el, name] of [[iconRef.current, 'pack-mark'], [nameRef.current, 'pack-title']] as const) {
      if (!el) continue
      el.style.viewTransitionName = name
      window.setTimeout(() => { el.style.viewTransitionName = '' }, 600)
    }
    // Tell the pack page its half of the morph is worth naming. Without this a
    // pack opened from anywhere else (Dzisiaj, a deep link) would animate a
    // lone half, which reads as a glitch — see armMorph.
    armMorph(`pack:${pack.id}`)
    openFlow(`/pakiet/${pack.id}`)
  }

  return (
    <article
      id={`pack-${pack.id}`}
      className={`packcard ${meta.cls}${isFrontier ? ' is-frontier' : ''}`}
      style={{
        // The category palette has existed in packVisuals since forever and was
        // wired to nothing. It rides on the emoji tile only — never on the state
        // edge, so violet keeps meaning "your next step" and gold "earned".
        ['--cat' as string]: getCategoryColor(pack.category),
        ['--i' as string]: index,
        ['--known-pct' as string]: knownPct,
        ['--heard-pct' as string]: Math.round(heardPct),
      }}
      data-num={num}
    >
      <a
        className="packcard__hit"
        href={`/pakiet/${pack.id}`}
        onPointerDown={() => preloadPath(`/pakiet/${pack.id}`)}
        onClick={open}
      >
        <span className="packcard__sr">
          {pack.name}, pakiet numer {num}, opanowane {known} z {total}
        </span>
      </a>

      <span className="packcard__mark" aria-hidden="true">
        <span className="packcard__tile">
          <span className="packcard__ring packcard__ring--known" />
          <span className="packcard__ring packcard__ring--heard" />
          <span className="packcard__icon" ref={iconRef}>{icon}</span>
        </span>
        <span className="packcard__num">{num}</span>
      </span>

      <span className="packcard__body">
        <span className="packcard__name" ref={nameRef}>{pack.name}</span>
        <span className="packcard__words">
          {words?.length ? words.join(' · ') : pack.category}
        </span>
        {isFrontier && (
          <span className="packcard__why">
            {prevNum ? `następny na trasie · zaraz po nr ${prevNum}` : 'początek trasy'}
          </span>
        )}
      </span>

      <span className="packcard__tail">
        {known > 0 && <span className="packcard__count"><b>{known}</b>/{total}</span>}
        {recall != null && <span className="packcard__recall">{recall}%</span>}
        {known === 0 && meta.label && <span className="packcard__state">{meta.label}</span>}
        {isFrontier && <span className="packcard__go">Dalej</span>}
        {!isFrontier && (
          <span className="packcard__chev" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </span>
        )}
      </span>
    </article>
  )
}
