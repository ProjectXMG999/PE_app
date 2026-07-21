import { useState, useEffect } from 'react'
import { AudioModal } from '../shared/AudioModal'
import '../home/OnboardingCard.css'

const HIDDEN_KEY = 'lp_training_onboarding_hidden'

const TRAINING_PARAGRAPHS = [
  'Cześć. Wchodzisz właśnie do zakładki Trening.',
  'Tu nie chodzi o to, żeby przeklikać jak najwięcej słówek. Tu chodzi o jedno: żebyś zaczął naprawdę mówić. Dlatego mamy cztery ćwiczenia i każde z nich robi coś konkretnego.',
  'Pierwsze to Słowo w Akcji. Widzisz słowo i od razu budujesz z nim krótkie frazy na głos. Uczysz mózg, że to słowo działa. Że potrafisz go użyć. Że nie musisz się go bać.',
  'Drugie to Moje Zdanie. Tworzysz zdanie z własnego życia. Nie z podręcznika, nie wymyślone — swoje. Mózg zapamiętuje to, co jest dla niego osobiste i konkretne.',
  'Trzecie to Jedno Słowo, Trzy Dziedziny. Bierzesz jedno słowo i używasz go w trzech różnych sytuacjach — w domu, w pracy, w codziennym życiu. To właśnie tak działa prawdziwy język.',
  'Czwarte to Drabina Zdania. Zaczynasz od prostego zdania i rozwijasz je krok po kroku. Uczysz się mówić więcej, pełniej, swobodniej.',
  'Każde ćwiczenie to inny rodzaj treningu. Razem tworzą system, który naprawdę działa.',
  'Wybierz ćwiczenie i zacznij. Mały krok. Codziennie.',
]

export function TrainingOnboardingCard() {
  const [isVisible, setIsVisible] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(HIDDEN_KEY)) setIsVisible(false)
  }, [])

  if (!isVisible) return null

  return (
    <>
      <div className="onboarding-card">
        <div className="onboarding-card__content">
          <div className="onboarding-card__header">
            <h3 className="onboarding-card__title">🏋️ Jak działa Trening?</h3>
            <button
              className="onboarding-card__close"
              onClick={() => { setIsVisible(false); localStorage.setItem(HIDDEN_KEY, 'true') }}
              aria-label="Hide"
            >
              ✕
            </button>
          </div>
          <p className="onboarding-card__text">
            Posłuchaj jak działają cztery ćwiczenia treningowe i po co każde z nich jest
          </p>
          <div className="onboarding-card__actions">
            <button className="onboarding-card__btn" onClick={() => setIsPlaying(true)}>
              🎧 Słuchaj (1 min)
            </button>
          </div>
        </div>
      </div>

      {isPlaying && (
        <AudioModal
          title="Jak działa Trening?"
          label="Trening"
          duration="1 min"
          src="/audio/training-intro.mp3"
          paragraphs={TRAINING_PARAGRAPHS}
          onClose={() => setIsPlaying(false)}
        />
      )}
    </>
  )
}
