import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAppStore } from '../store/useAppStore'
import './SettingsPage.css'

const EN_RATES = [0.5, 0.6, 0.7, 0.8, 1.0]
const PL_RATES = [0.8, 0.9, 1.0, 1.1, 1.2]

function rateLabel(r: number) {
  return `${r}×`
}

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
              {EN_RATES.map(r => (
                <button
                  key={r}
                  className={`settings__pill ${enRate === r ? 'settings__pill--active' : ''}`}
                  onClick={() => setEnRate(r)}
                >
                  {rateLabel(r)}
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
              {PL_RATES.map(r => (
                <button
                  key={r}
                  className={`settings__pill ${plRate === r ? 'settings__pill--active' : ''}`}
                  onClick={() => setPlRate(r)}
                >
                  {rateLabel(r)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
