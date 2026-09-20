import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AudioModal } from '../shared/AudioModal'
import { Sheet, useSheetMotion, type SheetHandle } from '../shared/Sheet'
import audioTimings from '../../data/audioTimings.json'
import './OnboardingModal.css'

const ONBOARDING_SEEN_KEY = 'lp_onboarding_seen'

const WELCOME_PARAGRAPHS = [
  'Witaj w Language Performance.',
  'To nie jest zwykła aplikacja do klikania słówek. To jest Twój językowy trening. Zaprojektowaliśmy ją tak, żeby prowadzić Cię krok po kroku — jak trener na siłowni albo dobry plan treningowy.',
  'Naszym celem jest prosta rzecz: chcemy nauczyć Cię tych słów, które dadzą Ci najwięcej mówienia w najkrótszym czasie. Dlatego słownictwo nie jest tutaj przypadkowe. Jest ułożone od najważniejszych słów do coraz bardziej precyzyjnych. Najpierw uczysz się tego, co naprawdę pozwala przetrwać, dogadać się, zareagować i powiedzieć coś o sobie.',
  'Masz tutaj dwa główne tryby.',
  'Pierwszy to Słuchaj. To tryb audio. Możesz uczyć się w drodze, na spacerze, w samochodzie albo wtedy, kiedy nie chcesz patrzeć w ekran. Osłuchujesz się ze słowami, zdaniami i rytmem języka.',
  'Drugi to Trenuj. To tryb treningowy. Tutaj słowo przestaje być tylko znane. Zaczynasz je przypominać sobie, mówić na głos, łączyć w frazy i budować z nim zdania.',
  'W treningu spotkasz cztery ćwiczenia: Słowo w Akcji, Moje Zdanie, Jedno Słowo, Trzy Dziedziny i Drabina Zdania. Każde z nich robi coś innego. Najpierw uczysz mózg, że słowo działa. Potem tworzysz własne zdanie. Potem przenosisz słowo do różnych sytuacji. A na końcu uczysz się rozwijać wypowiedź.',
  'Będziesz też przechodzić przez poziomy. Level 1 to survival — zaczynasz sobie radzić. Level 2 to codzienna komunikacja. Level 3 to językowa wolność. Level 4 to angielski, który robi wrażenie.',
  'Nie musisz robić wszystkiego idealnie. Masz robić małe kroki. Słuchać. Trenować. Mówić na głos. Wracać. I widzieć progres.',
  'Zaczynamy. Wybierz paczkę i zrób pierwszy trening.',
]

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const sheet = useRef<SheetHandle>(null)
  // What the user chose, acted on once the card has actually left.
  const intent = useRef<'close' | 'audio'>('close')
  const { rise, tap } = useSheetMotion()

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_SEEN_KEY)
    if (!seen) {
      setIsOpen(true)
    }
  }, [])

  // Every way out of this card — both buttons, ESC, the backdrop — funnels
  // through the sheet's close, so the seen-flag is always persisted exactly
  // once and the intro only starts after the card has finished leaving.
  const handleClosed = () => {
    setIsOpen(false)
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
    if (intent.current === 'audio') setIsPlaying(true)
  }

  const leave = (pick: 'close' | 'audio') => {
    intent.current = pick
    sheet.current?.close()
  }

  return (
    <>
      {isOpen && (
        <Sheet
          ref={sheet}
          onClose={handleClosed}
          className="onboarding-modal"
          aria-label="Witaj w Language Performance"
          centered
          grabber={false}
        >
          <button
            type="button"
            className="onboarding-modal__close"
            onClick={() => leave('close')}
            aria-label="Zamknij"
          >
            ✕
          </button>

          <div className="onboarding-modal__content">
            <motion.h2 className="onboarding-modal__title" variants={rise}>
              Witaj w Language Performance 👋
            </motion.h2>
            <motion.p className="onboarding-modal__subtitle" variants={rise}>
              To nie jest zwykła aplikacja do klikania słówek. To jest Twój językowy trening.
            </motion.p>

            <motion.div className="onboarding-modal__actions" variants={rise}>
              <motion.button
                type="button"
                className="onboarding-modal__btn onboarding-modal__btn--primary"
                whileTap={tap}
                onClick={() => leave('audio')}
              >
                🎧 Słuchaj intro
              </motion.button>
              <motion.button
                type="button"
                className="onboarding-modal__btn onboarding-modal__btn--secondary"
                whileTap={tap}
                onClick={() => leave('close')}
              >
                Rozpocznij trening
              </motion.button>
            </motion.div>

            <motion.p className="onboarding-modal__hint" variants={rise}>
              Możesz wrócić do tej informacji w dowolnym momencie
            </motion.p>
          </div>
        </Sheet>
      )}

      {isPlaying && (
        <AudioModal
          title="Witaj w Language Performance"
          label="Intro"
          duration="2 min"
          src="/audio/intro-welcome.mp3"
          paragraphs={WELCOME_PARAGRAPHS}
          timings={audioTimings['intro-welcome.mp3'].timings}
          onClose={() => setIsPlaying(false)}
        />
      )}
    </>
  )
}
