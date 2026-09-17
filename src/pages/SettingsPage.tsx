import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { AboutAppSection } from '../components/settings/AboutAppSection'
import { InstallGuideSection } from '../components/settings/InstallGuideSection'
import { ResetProgressModal } from '../components/stats/ResetProgressModal'
import { ProgressLogo } from '../components/brand/ProgressLogo'
import { fadeUp, fadeUpReduced, staggerContainer } from '../components/today/motion'
import { Row, Section, Segmented, Toggle } from '../components/settings/PrefsList'
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

export function SettingsPage() {
  const {
    enRate, plRate, setEnRate, setPlRate,
    theme, setTheme,
    showDebug, setShowDebug,
    devUnlocked, setDevUnlocked,
    dailyGoalSec, setDailyGoalSec,
    soundEnabled, setSoundEnabled,
    reviewHealth,
  } = useAppStore()
  const [showReset, setShowReset] = useState(false)
  const versionTapsRef = useRef<number[]>([])
  const version = import.meta.env.VITE_APP_VERSION || '1.0.0'

  // Easter egg: 5 quick taps on the version toggles the developer section.
  // Moved here from the phone's top bar, which no longer shows the version.
  function onVersionTap() {
    const now = Date.now()
    versionTapsRef.current = [...versionTapsRef.current.filter(t => now - t < 3000), now]
    if (versionTapsRef.current.length >= 5) {
      versionTapsRef.current = []
      setDevUnlocked(!devUnlocked)
    }
  }
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
          <span className="settings__version" onClick={onVersionTap}>
            Wersja {version}
          </span>
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
