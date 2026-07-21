import { useState } from 'react'
import { AudioModal } from '../shared/AudioModal'
import './TrainingOnboardingCard.css'

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
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <>
      <button className="training-intro-bar" onClick={() => setIsPlaying(true)}>
        <span className="training-intro-bar__icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
        </span>
        <span className="training-intro-bar__text">Jak działa Trening?</span>
        <span className="training-intro-bar__badge">1 min</span>
      </button>

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
