import { useEffect, useState } from 'react'
import './OnboardingModal.css'

const ONBOARDING_SEEN_KEY = 'lp_onboarding_seen'

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_SEEN_KEY)
    if (!seen) {
      setIsOpen(true)
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
  }

  const handlePlayAudio = () => {
    setIsPlaying(true)
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
  }

  if (!isOpen) return null

  return (
    <>
      <div className="onboarding-modal__overlay" onClick={handleClose} />
      <div className="onboarding-modal">
        <button className="onboarding-modal__close" onClick={handleClose} aria-label="Close">
          ✕
        </button>

        <div className="onboarding-modal__content">
          <h2 className="onboarding-modal__title">Witaj w Language Performance 👋</h2>
          <p className="onboarding-modal__subtitle">
            To nie jest zwykła aplikacja do klikania słówek. To jest Twój językowy trening.
          </p>

          <div className="onboarding-modal__actions">
            <button
              className="onboarding-modal__btn onboarding-modal__btn--primary"
              onClick={handlePlayAudio}
            >
              🎧 Słuchaj intro
            </button>
            <button
              className="onboarding-modal__btn onboarding-modal__btn--secondary"
              onClick={handleClose}
            >
              Rozpocznij trening
            </button>
          </div>

          <p className="onboarding-modal__hint">
            Możesz wrócić do tej informacji w dowolnym momencie
          </p>
        </div>
      </div>

      {isPlaying && (
        <div className="onboarding-modal__audio-player">
          <div className="onboarding-modal__audio-content">
            <button
              className="onboarding-modal__audio-close"
              onClick={() => setIsPlaying(false)}
            >
              ✕
            </button>
            <h3>Witaj w Language Performance</h3>
            <audio
              controls
              autoPlay
              className="onboarding-modal__audio"
              onEnded={() => setIsPlaying(false)}
            >
              <source src="/audio/intro-welcome.mp3" type="audio/mpeg" />
              Twoja przeglądarka nie obsługuje odtwarzania audio.
            </audio>
          </div>
        </div>
      )}
    </>
  )
}
