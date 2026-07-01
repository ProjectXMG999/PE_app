import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
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
  const navigate = useNavigate()
  const { enRate, plRate, setEnRate, setPlRate } = useAppStore()

  return (
    <AppShell hideBottomNav>
      <div className="settings">
        <div className="settings__header">
          <button className="settings__back" onClick={() => navigate(-1)} aria-label="Wróć">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="settings__title">Ustawienia</span>
        </div>

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
            <div className="settings__pills">
              {RATES.map(({ value, label }) => (
                <button
                  key={value}
                  className={`settings__pill ${plRate === value ? 'settings__pill--active' : ''}`}
                  onClick={() => setPlRate(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
