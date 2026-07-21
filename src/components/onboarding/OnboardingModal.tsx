import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AudioModal } from '../shared/AudioModal'
import './OnboardingModal.css'

const ONBOARDING_SEEN_KEY = 'lp_onboarding_seen'

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
    setIsOpen(false)
    setIsPlaying(true)
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
  }

  return (
    <>
      {isOpen && createPortal(
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
        </>,
        document.body
      )}

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
