import { useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { AboutAppSection } from '../components/settings/AboutAppSection'
import { InstallGuideSection } from '../components/settings/InstallGuideSection'
import { ResetProgressModal } from '../components/stats/ResetProgressModal'
import { ProgressLogo } from '../components/brand/ProgressLogo'
import { fadeUp, fadeUpReduced, staggerContainer } from '../components/today/motion'
import { useAppStore, ThemePreference, DAILY_GOAL_OPTIONS } from '../store/useAppStore'
import { healthValue, requestRetentionFor, reviewRatioFor } from '../services/reviewHealth'
import { SMART } from '../services/smartQueue'
import { RATES } from '../constants/audioRates'
import './SettingsPage.css'

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Ciemny' },
  { value: 'light', label: 'Jasny' },
  { value: 'system', label: 'Systemowy' },
]

/**
 * One titled glass card: the kicker labels it, the card holds the rows.
 * `plain` skips the card for children that already are cards of their own
 * (the install guide, the About panel) — they still get the section label, so
 * every block on the page hangs off the same rhythm.
 */
function Section({ title, plain = false, children }: {
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
function Row({ name, hint, control, inline = false }: {
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
function Segmented<T extends string | number>({ options, value, onChange, label }: {
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

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
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

export function SettingsPage() {
  const {
    enRate, plRate, setEnRate, setPlRate,
    theme, setTheme,
    showDebug, setShowDebug,
    devUnlocked,
    dailyGoalSec, setDailyGoalSec,
    soundEnabled, setSoundEnabled,
    reviewHealth,
  } = useAppStore()
  const [showReset, setShowReset] = useState(false)
  const reduced = useReducedMotion()
  const item = reduced ? fadeUpReduced : fadeUp

  const goalOptions = DAILY_GOAL_OPTIONS.map(min => ({ value: min, label: String(min) }))
  const rateOptions = RATES.map(r => ({ value: r.value, label: r.label }))

  return (
    <AppShell>
      <motion.div
        className="settings"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.header className="settings__header" variants={item}>
          <p className="settings__kicker u-kicker">Ustawienia</p>
          <h1 className="settings__title u-display">Personalizacja</h1>
        </motion.header>

        <Section title="Nauka">
          <Row
            name="Cel na dzień"
            hint="Minuty dziennie. Lepszy mniejszy cel, który utrzymasz."
            control={
              <Segmented
                label="Cel na dzień"
                options={goalOptions}
                value={dailyGoalSec / 60}
                onChange={min => setDailyGoalSec(min * 60)}
              />
            }
          />
        </Section>

        <Section title="Wygląd">
          <Row
            name="Motyw"
            hint="Systemowy podąża za ustawieniem urządzenia"
            control={
              <Segmented label="Motyw aplikacji" options={THEMES} value={theme} onChange={setTheme} />
            }
          />
        </Section>

        <Section title="Dźwięk i wibracje">
          <Row
            inline
            name="Dźwięki interfejsu"
            hint="Krótkie dźwięki i wibracje przy kluczowych akcjach"
            control={
              <Toggle on={soundEnabled} onChange={setSoundEnabled} label="Dźwięki interfejsu" />
            }
          />
        </Section>

        <Section title="Tempo audio">
          <Row
            name="Angielski"
            hint="Słowa i zdania po angielsku"
            control={
              <Segmented
                label="Tempo audio angielskiego"
                options={rateOptions}
                value={enRate}
                onChange={setEnRate}
              />
            }
          />
          <Row
            name="Polski"
            hint="Słowa i zdania po polsku"
            control={
              <Segmented
                label="Tempo audio polskiego"
                options={rateOptions}
                value={plRate}
                onChange={setPlRate}
              />
            }
          />
        </Section>

        <Section title="Aplikacja" plain>
          <InstallGuideSection />
          <AboutAppSection />
        </Section>

        <Section title="Dane">
          <Row
            inline
            name="Resetuj progres"
            hint="Usuwa zapisany postęp nauki"
            control={
              <button className="settings__danger-btn" onClick={() => setShowReset(true)}>
                Resetuj…
              </button>
            }
          />
        </Section>

        {devUnlocked && (
          <Section title="Deweloper">
            <Row
              inline
              name="Logi debugowania"
              hint="Panel logów audio i akcji"
              control={<Toggle on={showDebug} onChange={setShowDebug} label="Logi debugowania" />}
            />
            {/* The review-health loop's own numbers, so the constants in
                reviewHealth.ts can be judged against a real learner's data
                instead of the estimate they started as. Dev-only, untranslated
                on purpose — it's an instrument, not a feature. */}
            <Row
              name="Review health"
              control={null}
              hint={
                reviewHealth.value == null
                  ? 'brak pomiaru'
                  : `H ${reviewHealth.value.toFixed(3)} · n ${reviewHealth.samples}` +
                    ` · ratio ${reviewRatioFor(reviewHealth, { base: SMART.REVIEW_RATIO }).toFixed(2)}` +
                    ` · rr ${requestRetentionFor(reviewHealth).toFixed(3)}` +
                    `${healthValue(reviewHealth) == null ? ' · uśpione' : ''}`
              }
            />
          </Section>
        )}

        {/* Signature at the foot of the page — the one place the full brand
            lockup appears, with the studio behind it named underneath. */}
        <motion.footer className="settings__brand" variants={item}>
          <ProgressLogo size={46} stacked byline />
        </motion.footer>
      </motion.div>

      {showReset && (
        <ResetProgressModal
          onClose={() => setShowReset(false)}
          onReset={() => setShowReset(false)}
        />
      )}
    </AppShell>
  )
}
