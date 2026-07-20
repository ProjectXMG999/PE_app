import { useState, useEffect } from 'react'
import './OnboardingCard.css'

const ONBOARDING_CARD_HIDDEN_KEY = 'lp_onboarding_card_hidden'

export function OnboardingCard() {
  const [isVisible, setIsVisible] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const hidden = localStorage.getItem(ONBOARDING_CARD_HIDDEN_KEY)
    if (hidden) {
      setIsVisible(false)
    }
  }, [])

  const handleHide = () => {
    setIsVisible(false)
    localStorage.setItem(ONBOARDING_CARD_HIDDEN_KEY, 'true')
  }

  const handlePlayAudio = () => {
    setIsPlaying(true)
  }

  if (!isVisible) return null

  return (
    <>
      <div className="onboarding-card">
        <div className="onboarding-card__content">
          <div className="onboarding-card__header">
            <h3 className="onboarding-card__title">🎧 Poznaj system</h3>
            <button
              className="onboarding-card__close"
              onClick={handleHide}
              aria-label="Hide"
            >
              ✕
            </button>
          </div>
          <p className="onboarding-card__text">
            Słuchaj jak działa Language Performance i jak będziesz się uczyć
          </p>
          <div className="onboarding-card__actions">
            <button
              className="onboarding-card__btn"
              onClick={handlePlayAudio}
            >
              🎧 Słuchaj (2 min)
            </button>
            <button
              className="onboarding-card__link"
              onClick={() => window.location.hash = '#/ustawienia'}
            >
              Więcej informacji →
            </button>
          </div>
        </div>
      </div>

      {isPlaying && (
        <div className="onboarding-card__audio-overlay">
          <div className="onboarding-card__audio-modal">
            <button
              className="onboarding-card__audio-close"
              onClick={() => setIsPlaying(false)}
            >
              ✕
            </button>
            <h3>Witaj w Language Performance</h3>
            <audio
              controls
              autoPlay
              className="onboarding-card__audio"
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
