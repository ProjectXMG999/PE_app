import { AppShell } from '../components/layout/AppShell'
import { AboutAppSection } from '../components/settings/AboutAppSection'
import { InstallGuideSection } from '../components/settings/InstallGuideSection'
import { useAppStore } from '../store/useAppStore'
import './SettingsPage.css'

// Multipliers relative to default speed: 1.0 = 100% = default
const RATES: { value: number; label: string }[] = [
  { value: 0.50, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1.00, label: '100%' },
  { value: 1.25, label: '125%' },
  { value: 1.50, label: '150%' },
]

export function SettingsPage() {
  const { enRate, plRate, setEnRate, setPlRate, showDebug, setShowDebug } = useAppStore()

  return (
    <AppShell>
      <div className="settings">
        <div className="settings__header">
          <span className="settings__title">Personalizacja</span>
        </div>

        <AboutAppSection />

        <InstallGuideSection />

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
      </div>
    </AppShell>
  )
}
