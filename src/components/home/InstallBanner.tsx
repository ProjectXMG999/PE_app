import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { isIOS, isInStandaloneMode, triggerInstall } from '../../services/installService'
import './InstallBanner.css'

export function InstallBanner() {
  const { installPromptEvent, isInstalled, iosBannerDismissed, setInstalled, dismissIOSBanner } = useAppStore()
  const [showIOS, setShowIOS] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const shouldShowIOS = isIOS() && !isInStandaloneMode() && !iosBannerDismissed
    console.log('[install] iOS banner logic:', { isIOS: isIOS(), isStandalone: isInStandaloneMode(), iosBannerDismissed, shouldShowIOS })
    setShowIOS(shouldShowIOS)
  }, [iosBannerDismissed])

  if (isInstalled || isInStandaloneMode()) {
    console.log('[install] banner hidden:', { isInstalled, isStandalone: isInStandaloneMode() })
    return null
  }

  if (installPromptEvent) {
    console.log('[install] showing Android banner')
    return (
      <div className="install-banner install-banner--android animate-slide-up">
        <div className="install-banner__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <div className="install-banner__text">
          <span className="install-banner__title">Zainstaluj Project English</span>
          <span className="install-banner__sub">Dodaj do ekranu głównego — szybki dostęp</span>
        </div>
        <button
          className="install-banner__btn"
          onClick={async () => {
            setInstalling(true)
            const result = await triggerInstall()
            if (result === 'accepted') setInstalled()
            setInstalling(false)
          }}
          disabled={installing}
        >
          {installing ? '...' : 'Dodaj'}
        </button>
      </div>
    )
  }

  if (showIOS) {
    console.log('[install] showing iOS banner')
    return (
      <div className="install-banner install-banner--ios animate-slide-up">
        <div className="install-banner__ios-header">
          <div className="install-banner__ios-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Zainstaluj aplikację na iOS
          </div>
          <button className="install-banner__dismiss" onClick={dismissIOSBanner}>✕</button>
        </div>
        <ol className="install-banner__ios-steps">
          <li>
            <span className="install-banner__step-num">1</span>
            Naciśnij ikonę
            <svg className="install-banner__ios-share" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <strong>Udostępnij</strong> w Safari
          </li>
          <li>
            <span className="install-banner__step-num">2</span>
            Wybierz <strong>"Dodaj do ekranu głównego"</strong>
          </li>
          <li>
            <span className="install-banner__step-num">3</span>
            Naciśnij <strong>"Dodaj"</strong>
          </li>
        </ol>
      </div>
    )
  }

  return null
}
