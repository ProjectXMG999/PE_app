import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Sheet, useSheetMotion, type SheetHandle } from '../shared/Sheet'
import { LEVEL_META } from '../../data/levels'
import './LevelUpPrompt.css'

interface Props {
  target: number
  onAccept: () => void
  onDecline: () => void
}

/**
 * "You're doing great — raise your default level?" Fires from
 * shouldPromptLevelUp (services/comfort.ts) after a run of strong Inteligentny
 * sessions. Deliberately reassuring about what "raising" actually means: the
 * floor moves, but the mix stays dynamic — easier words still come back.
 *
 * The one sheet the app opens by itself rather than on a tap, which is exactly
 * why it gets the same arrival as the rest: unannounced, it should land like a
 * card being placed in front of you, not appear mid-screen already there.
 */
export function LevelUpPrompt({ target, onAccept, onDecline }: Props) {
  const sheet = useRef<SheetHandle>(null)
  // The answer is recorded on the press and acted on once the sheet has
  // actually left. Both callbacks unmount this component, so running them on
  // the press killed the exit mid-flight — and every way out that isn't a
  // button (ESC, the backdrop, a flick down) means "not now".
  const choice = useRef<'accept' | 'decline'>('decline')
  const { rise, tap } = useSheetMotion()
  const level = LEVEL_META.find(l => l.level === target)

  function answer(pick: 'accept' | 'decline') {
    choice.current = pick
    sheet.current?.close()
  }

  return (
    <Sheet
      ref={sheet}
      onClose={() => (choice.current === 'accept' ? onAccept() : onDecline())}
      className="levelup__inner"
      aria-label="Podnieść poziom?"
    >
      <motion.span className="levelup__icon" variants={rise} aria-hidden="true">🎉</motion.span>
      <motion.h2 className="levelup__title" variants={rise}>Świetnie Ci idzie</motion.h2>
      <motion.p className="levelup__sub" variants={rise}>
        Twój poziom to teraz <strong>{level?.name ?? `Poziom ${target}`}</strong>.
        Ustawić go jako domyślny?
      </motion.p>
      <motion.p className="levelup__note" variants={rise}>
        Nadal czasem wrócimy do łatwiejszych słów dla utrwalenia — ale na co
        dzień będziemy proponować trudniejsze treści.
      </motion.p>
      <motion.div className="levelup__actions" variants={rise}>
        <motion.button
          type="button"
          className="levelup__btn levelup__btn--primary"
          whileTap={tap}
          onClick={() => answer('accept')}
        >
          Tak, podnieś
        </motion.button>
        <motion.button
          type="button"
          className="levelup__btn"
          whileTap={tap}
          onClick={() => answer('decline')}
        >
          Jeszcze nie
        </motion.button>
      </motion.div>
    </Sheet>
  )
}
