import { useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { AboutAppSection } from '../components/settings/AboutAppSection'
import { InstallGuideSection } from '../components/settings/InstallGuideSection'
import { ResetProgressModal } from '../components/stats/ResetProgressModal'
import { useAppStore, ThemePreference } from '../store/useAppStore'
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
    devUnlocked,
  } = useAppStore()
  const [showReset, setShowReset] = useState(false)

  return (
    <AppShell>
      <div className="settings">
        <div className="settings__header">
          <span className="settings__title">Personalizacja</span>
        </div>

        <div className="settings__section">
          <h2 className="settings__section-title">Wygląd</h2>
          <div className="settings__row">
            <div className="settings__row-label">
              <span className="settings__row-name">Motyw</span>
              <span className="settings__row-hint">Systemowy podąża za ustawieniem urządzenia</span>
            </div>
            <div className="settings__pills" role="radiogroup" aria-label="Motyw aplikacji">
              {THEMES.map(({ value, label }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={theme === value}
                  className={`settings__pill ${theme === value ? 'settings__pill--active' : ''}`}
                  onClick={() => setTheme(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings__section">
          <h2 className="settings__section-title">Tempo audio</h2>

          <div className="settings__row">
            <div className="settings__row-label">
              <span className="settings__row-name">Angielski</span>
              <span className="settings__row-hint">słowa i zdania EN</span>
            </div>
            <div className="settings__pills" role="radiogroup" aria-label="Tempo audio angielskiego">
              {RATES.map(({ value, label }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={enRate === value}
                  className={`settings__pill ${enRate === value ? 'settings__pill--active' : ''}`}
                  onClick={() => setEnRate(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="settings__row">
            <div className="settings__row-label">
              <span className="settings__row-name">Polski</span>
              <span className="settings__row-hint">słowa i zdania PL</span>
            </div>
            <div className="settings__pills" role="radiogroup" aria-label="Tempo audio polskiego">
              {RATES.map(({ value, label }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={plRate === value}
                  className={`settings__pill ${plRate === value ? 'settings__pill--active' : ''}`}
                  onClick={() => setPlRate(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <InstallGuideSection />

        <AboutAppSection />

        <div className="settings__section">
          <h2 className="settings__section-title">Dane</h2>
          <div className="settings__row settings__row--toggle">
            <div className="settings__row-label">
              <span className="settings__row-name">Resetuj progres</span>
              <span className="settings__row-hint">Usuwa zapisany postęp nauki</span>
            </div>
            <button className="settings__danger-btn" onClick={() => setShowReset(true)}>
              Resetuj…
            </button>
          </div>
        </div>

        {devUnlocked && (
          <div className="settings__section">
            <h2 className="settings__section-title">Deweloper</h2>
            <div className="settings__row settings__row--toggle">
              <div className="settings__row-label">
                <span className="settings__row-name">Logi debugowania</span>
                <span className="settings__row-hint">Panel logów audio i akcji</span>
              </div>
              <button
                className={`settings__toggle ${showDebug ? 'settings__toggle--on' : ''}`}
                onClick={() => setShowDebug(!showDebug)}
                role="switch"
                aria-checked={showDebug}
                aria-label="Logi debugowania"
              >
                <span className="settings__toggle-thumb" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showReset && (
        <ResetProgressModal
          onClose={() => setShowReset(false)}
          onReset={() => setShowReset(false)}
        />
      )}
    </AppShell>
  )
}
