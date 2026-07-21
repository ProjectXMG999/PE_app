import { AppShell } from '../components/layout/AppShell'
import { AboutAppSection } from '../components/settings/AboutAppSection'
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

const VALID = new Set(RATES.map(r => r.value))

export function SettingsPage() {
  const { enRate, plRate, setEnRate, setPlRate, showDebug, setShowDebug } = useAppStore()

  // Migrate legacy absolute values (e.g. 0.60) that don't match current multiplier scale
  const safeEnRate = VALID.has(enRate) ? enRate : 1.0
  const safePlRate = VALID.has(plRate) ? plRate : 1.0
  if (safeEnRate !== enRate) setEnRate(safeEnRate)
  if (safePlRate !== plRate) setPlRate(safePlRate)

  return (
    <AppShell>
      <div className="settings">
        <div className="settings__header">
          <span className="settings__title">Personalizacja</span>
        </div>

        <AboutAppSection />

        <div className="settings__section">
          <h2 className="settings__section-title">Tempo audio</h2>

          <div className="settings__row">
            <div className="settings__row-label">
              <span className="settings__row-name">Angielski</span>
              <span className="settings__row-hint">słowa i zdania EN</span>
            </div>
            <div className="settings__pills">
              {RATES.map(({ value, label }) => (
                <button
                  key={value}
                  className={`settings__pill ${safeEnRate === value ? 'settings__pill--active' : ''}`}
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
            <div className="settings__pills">
              {RATES.map(({ value, label }) => (
                <button
                  key={value}
                  className={`settings__pill ${safePlRate === value ? 'settings__pill--active' : ''}`}
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
              aria-label="Toggle debug"
            >
              <span className="settings__toggle-thumb" />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
