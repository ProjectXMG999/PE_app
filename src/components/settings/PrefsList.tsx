import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeUp, fadeUpReduced } from '../today/motion'
import './PrefsList.css'

/**
 * The building blocks of a settings-style page — Ustawienia and Konto. One
 * system, so the two pages can't drift into two looks again.
 */

/**
 * One titled glass card: the kicker labels it, the card holds the rows.
 * `plain` skips the card for children that already are cards of their own
 * (the install guide, the About panel) — they still get the section label, so
 * every block on the page hangs off the same rhythm.
 */
export function Section({ title, plain = false, children }: {
  title: string
  plain?: boolean
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  return (
    <motion.section className="settings__section" variants={reduced ? fadeUpReduced : fadeUp}>
      <h2 className="settings__section-title u-kicker">{title}</h2>
      {plain ? children : <div className="settings__card u-surface">{children}</div>}
    </motion.section>
  )
}

/**
 * A setting: what it is on the left, what it's set to on the right (or below,
 * when the control is a segmented track that needs the full width).
 */
export function Row({ name, hint, control, inline = false }: {
  name: string
  hint?: string
  control: ReactNode
  inline?: boolean
}) {
  return (
    <div className={`settings__row${inline ? ' settings__row--inline' : ''}`}>
      <span className="settings__row-label">
        <span className="settings__row-name">{name}</span>
        {hint && <span className="settings__row-hint">{hint}</span>}
      </span>
      <span className="settings__row-control">{control}</span>
    </div>
  )
}

/** The app's one segmented control — same track/pill as the listening tempo. */
export function Segmented<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <span className="settings__track" role="radiogroup" aria-label={label}>
      {options.map(opt => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={value === opt.value}
          className={`settings__pill${value === opt.value ? ' settings__pill--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </span>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className={`settings__toggle${on ? ' settings__toggle--on' : ''}`}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      aria-label={label}
    >
      <span className="settings__toggle-thumb" />
    </button>
  )
}

