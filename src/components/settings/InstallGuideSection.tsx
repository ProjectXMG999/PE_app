import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { isIOS, isInStandaloneMode, triggerInstall } from '../../services/installService'
import './InstallGuideSection.css'

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  if (isIOS()) return 'ios'
  if (/android/i.test(navigator.userAgent)) return 'android'
  return 'desktop'
}

export function InstallGuideSection() {
  const { installPromptEvent, isInstalled, setInstalled } = useAppStore()
  const [installing, setInstalling] = useState(false)
  const [activePlatform, setActivePlatform] = useState<Platform>(detectPlatform)

  if (isInstalled || isInStandaloneMode()) return null

  const handleInstall = async () => {
    setInstalling(true)
    const result = await triggerInstall()
    if (result === 'accepted') setInstalled()
    setInstalling(false)
  }

  const PLATFORMS: { key: Platform; label: string; icon: React.ReactNode }[] = [
    {
      key: 'ios',
      label: 'iPhone / iPad',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
      ),
    },
    {
      key: 'android',
      label: 'Android',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.523 15.341a.998.998 0 0 1-1-1 .998.998 0 0 1 1-1 .998.998 0 0 1 1 1 .998.998 0 0 1-1 1m-11.046 0a.998.998 0 0 1-1-1 .998.998 0 0 1 1-1 .998.998 0 0 1 1 1 .998.998 0 0 1-1 1m11.405-6.02l1.997-3.459a.418.418 0 0 0-.152-.571.418.418 0 0 0-.571.152l-2.023 3.503A11.985 11.985 0 0 0 12 8.1c-1.78 0-3.468.406-4.973 1.127L4.844 5.443a.418.418 0 0 0-.571-.152.418.418 0 0 0-.152.571l1.997 3.459C3.532 10.795 1.8 13.218 1.8 16.05h20.4c0-2.832-1.732-5.255-4.318-6.729"/>
        </svg>
      ),
    },
    {
      key: 'desktop',
      label: 'Komputer',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="install-guide">
      <div className="install-guide__header">
        <div className="install-guide__icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <div>
          <h4 className="install-guide__title">Dodaj do ekranu głównego</h4>
          <p className="install-guide__subtitle">Szybki dostęp bez otwierania przeglądarki</p>
        </div>
      </div>

      <div className="install-guide__tabs">
        {PLATFORMS.map(p => (
          <button
            key={p.key}
            className={`install-guide__tab ${activePlatform === p.key ? 'install-guide__tab--active' : ''}`}
            onClick={() => setActivePlatform(p.key)}
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>

      {activePlatform === 'ios' && (
        <div className="install-guide__steps">
          <div className="install-guide__step">
            <span className="install-guide__step-num">1</span>
            <div className="install-guide__step-body">
              <span>Otwórz stronę w <strong>Safari</strong> i naciśnij ikonę</span>
              <span className="install-guide__share-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </span>
              <strong>Udostępnij</strong> na dole ekranu
            </div>
          </div>
          <div className="install-guide__step">
            <span className="install-guide__step-num">2</span>
            <div className="install-guide__step-body">
              Przewiń w dół i wybierz <strong>"Dodaj do ekranu głównego"</strong>
            </div>
          </div>
          <div className="install-guide__step">
            <span className="install-guide__step-num">3</span>
            <div className="install-guide__step-body">
              Naciśnij <strong>"Dodaj"</strong> — gotowe
            </div>
          </div>
        </div>
      )}

      {activePlatform === 'android' && (
        <div className="install-guide__steps">
          {installPromptEvent ? (
            <div className="install-guide__cta">
              <p className="install-guide__cta-text">Twoja przeglądarka obsługuje automatyczną instalację.</p>
              <button
                className="install-guide__cta-btn"
                onClick={handleInstall}
                disabled={installing}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {installing ? 'Instalowanie…' : 'Zainstaluj teraz'}
              </button>
            </div>
          ) : (
            <>
              <div className="install-guide__step">
                <span className="install-guide__step-num">1</span>
                <div className="install-guide__step-body">
                  Otwórz stronę w <strong>Chrome</strong> i naciśnij menu <strong>⋮</strong> w prawym górnym rogu
                </div>
              </div>
              <div className="install-guide__step">
                <span className="install-guide__step-num">2</span>
                <div className="install-guide__step-body">
                  Wybierz <strong>"Dodaj do ekranu głównego"</strong>
                </div>
              </div>
              <div className="install-guide__step">
                <span className="install-guide__step-num">3</span>
                <div className="install-guide__step-body">
                  Naciśnij <strong>"Dodaj"</strong> — gotowe
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activePlatform === 'desktop' && (
        <div className="install-guide__steps">
          <div className="install-guide__step">
            <span className="install-guide__step-num">1</span>
            <div className="install-guide__step-body">
              Otwórz stronę w <strong>Chrome</strong> lub <strong>Edge</strong>
            </div>
          </div>
          <div className="install-guide__step">
            <span className="install-guide__step-num">2</span>
            <div className="install-guide__step-body">
              Kliknij ikonę
              <span className="install-guide__share-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </span>
              w pasku adresu lub wybierz z menu <strong>"Zainstaluj aplikację"</strong>
            </div>
          </div>
          <div className="install-guide__step">
            <span className="install-guide__step-num">3</span>
            <div className="install-guide__step-body">
              Potwierdź instalację — aplikacja pojawi się na pulpicie
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
