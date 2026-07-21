import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AudioModal } from '../shared/AudioModal'
import './OnboardingCard.css'

const ONBOARDING_CARD_HIDDEN_KEY = 'lp_onboarding_card_hidden'

const WELCOME_PARAGRAPHS = [
  'Witaj w Language Performance.',
  'To nie jest zwykła aplikacja do klikania słówek. To jest Twój językowy trening. Zaprojektowaliśmy ją tak, żeby prowadzić Cię krok po kroku — jak trener na siłowni albo dobry plan treningowy.',
  'Naszym celem jest prosta rzecz: chcemy nauczyć Cię tych słów, które dadzą Ci najwięcej mówienia w najkrótszym czasie. Dlatego słownictwo nie jest tutaj przypadkowe. Jest ułożone od najważniejszych słów do coraz bardziej precyzyjnych. Najpierw uczysz się tego, co naprawdę pozwala przetrwać, dogadać się, zareagować i powiedzieć coś o sobie.',
  'Masz tutaj dwa główne tryby.',
  'Pierwszy to Słuchaj. To tryb audio. Możesz uczyć się w drodze, na spacerze, w samochodzie albo wtedy, kiedy nie chcesz patrzeć w ekran. Osłuchujesz się ze słowami, zdaniami i rytmem języka.',
  'Drugi to Aktywuj. To tryb treningowy. Tutaj słowo przestaje być tylko znane. Zaczynasz je przypominać sobie, mówić na głos, łączyć w frazy i budować z nim zdania.',
  'W treningu spotkasz cztery ćwiczenia: Słowo w Akcji, Moje Zdanie, Jedno Słowo, Trzy Dziedziny i Drabina Zdania. Każde z nich robi coś innego. Najpierw uczysz mózg, że słowo działa. Potem tworzysz własne zdanie. Potem przenosisz słowo do różnych sytuacji. A na końcu uczysz się rozwijać wypowiedź.',
  'Będziesz też przechodzić przez poziomy. Level 1 to survival — zaczynasz sobie radzić. Level 2 to codzienna komunikacja. Level 3 to językowa wolność. Level 4 to angielski, który robi wrażenie.',
  'Nie musisz robić wszystkiego idealnie. Masz robić małe kroki. Słuchać. Aktywować. Mówić na głos. Wracać. I widzieć progres.',
  'Zaczynamy. Wybierz paczkę i zrób pierwszy trening.',
]

export function OnboardingCard() {
  const [isVisible, setIsVisible] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const navigate = useNavigate()

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
              onClick={() => setIsPlaying(true)}
            >
              🎧 Słuchaj (2 min)
            </button>
            <button
              className="onboarding-card__link"
              onClick={() => navigate('/ustawienia')}
            >
              Dowiedz się więcej →
            </button>
          </div>
        </div>
      </div>

      {isPlaying && (
        <AudioModal
          title="Witaj w Language Performance"
          label="Intro"
          duration="2 min"
          src="/audio/intro-welcome.mp3"
          paragraphs={WELCOME_PARAGRAPHS}
          onClose={() => setIsPlaying(false)}
        />
      )}
    </>
  )
}
