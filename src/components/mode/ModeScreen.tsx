import { ReactNode, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../layout/AppShell'
import { fadeUp, fadeUpReduced, staggerContainer } from '../today/motion'
import { noOrphans } from '../../utils/typography'
import './ModeScreen.css'

/**
 * The shared "how do you want to study this pack?" chooser — the screen that
 * sits between PackPreview and an actual session, on both study paths:
 *   /pakiet/:id/start        → Słuchaj (tone="listen", --listen-blue)
 *   /pakiet/:id/fiszki-start → Trenuj  (tone="train",  --accent)
 *
 * The two paths already have colour identities in PackPreview's action bar, so
 * they keep them here — everything else (header, cards, footnote) is one
 * layout, one set of type sizes, one motion cascade. Both pages differ only in
 * the content they hand in.
 */

export type ModeTone = 'listen' | 'train'

interface ScreenProps {
  tone: ModeTone
  /** ALL-CAPS eyebrow: which path you're on and which pack. */
  kicker: ReactNode
  /** The pack name — the one thing on screen that names *this* session. */
  title: string
  /** Small pills of hard facts (level, volume, word count). */
  facts?: ReactNode
  /** One sentence on what the choice below actually decides. */
  lead?: string
  onBack: () => void
  children: ReactNode
}

export function ModeScreen({ tone, kicker, title, facts, lead, onBack, children }: ScreenProps) {
  const reduced = useReducedMotion()
  const item = reduced ? fadeUpReduced : fadeUp

  return (
    <AppShell hideBottomNav hideSidebar={false} hideAmbient={false} lockScroll={false}>
      <motion.div
        className={`modescreen modescreen--${tone}`}
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div className="modescreen__nav" variants={item}>
          <button type="button" className="modescreen__back" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Pakiet</span>
          </button>
        </motion.div>

        <motion.header className="modescreen__head" variants={item}>
          <p className="modescreen__kicker u-kicker">{kicker}</p>
          <h1 className="modescreen__title u-display">{title}</h1>
          {facts && <div className="modescreen__facts">{facts}</div>}
          {lead && <p className="modescreen__lead">{noOrphans(lead)}</p>}
        </motion.header>

        {children}
      </motion.div>
    </AppShell>
  )
}

/**
 * A hard fact about the pack — one pill in the header row. `color` tints it
 * (the level pill carries the level's own colour, the same one the route map
 * and PackPreview use, so a level is always the same colour app-wide).
 */
export function ModeFact({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className={`modescreen__fact${color ? ' modescreen__fact--tinted' : ''}`}
      style={color ? ({ '--fact-color': color } as CSSProperties) : undefined}
    >
      {children}
    </span>
  )
}

/** A block in the cascade — rises in with the rest of the page. */
export function ModeBlock({ className, children }: { className?: string; children: ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.section className={className} variants={reduced ? fadeUpReduced : fadeUp}>
      {children}
    </motion.section>
  )
}

/** A small ALL-CAPS section label, optionally with a value on the right. */
export function ModeLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="modescreen__label">
      <span className="u-kicker">{children}</span>
      {aside && <span className="modescreen__label-aside">{aside}</span>}
    </div>
  )
}

interface CardProps {
  glyph: ReactNode
  name: string
  /** Two or three words placing the mode: "Najkrótsza sesja". */
  tagline?: string
  desc: string
  /** Anything that shows *how* the mode runs — e.g. the step strip. */
  detail?: ReactNode
  /** Hard numbers, on a hairline-separated footer row. */
  meta?: ReactNode
  /** The label on the card's action bar — what happens when you tap it. */
  cta: string
  /** This mode's own colour, from the categorical accents in tokens.css. */
  color: string
  badge?: string
  /** The mode currently remembered for this user — gets the brighter edge. */
  current?: boolean
  onClick: () => void
}

/**
 * The whole card is the tap target — there is no separate little arrow button
 * to hit. The bar at the bottom is a *label* for that tap (a span, not a
 * nested button), sized like a real thumb target so the card reads as
 * pressable on a phone rather than as a desktop list row.
 */
export function ModeCard({
  glyph, name, tagline, desc, detail, meta, cta, color, badge, current = false, onClick,
}: CardProps) {
  const reduced = useReducedMotion()

  return (
    <motion.button
      type="button"
      className={`modecard${current ? ' modecard--current' : ''}`}
      style={{ '--card-accent': color } as CSSProperties}
      onClick={onClick}
      variants={reduced ? fadeUpReduced : fadeUp}
      whileTap={reduced ? undefined : { scale: 0.985 }}
    >
      <span className="modecard__glyph" aria-hidden="true">{glyph}</span>

      <span className="modecard__head">
        <span className="modecard__name">{name}</span>
        {badge && <span className="modecard__badge">{badge}</span>}
      </span>

      {tagline && <span className="modecard__tagline">{tagline}</span>}

      <span className="modecard__desc">{noOrphans(desc)}</span>

      {(detail || meta) && (
        <span className="modecard__foot">
          {detail}
          {meta && <span className="modecard__meta">{meta}</span>}
        </span>
      )}

      <span className="modecard__cta">
        {cta}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </motion.button>
  )
}

/** The quiet "what is this mode for?" footnote at the bottom of both screens. */
export function ModeNote({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`modenote${open ? ' modenote--open' : ''}`}>
      <button
        type="button"
        className="modenote__toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="modenote__mark" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9.5" />
            <path d="M12 11v5.5M12 7.6v.1" />
          </svg>
        </span>
        <span className="modenote__label">{label}</span>
        <svg
          className="modenote__chevron"
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <p className="modenote__body">{children}</p>}
    </div>
  )
}
