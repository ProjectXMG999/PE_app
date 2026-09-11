import { useEffect, useRef } from 'react'
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
 */
export function LevelUpPrompt({ target, onAccept, onDecline }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  // A button press already ran its own action before closing the dialog —
  // the native `close` event (also fired by ESC / backdrop tap) must not run
  // decline a second time on top of it.
  const handledRef = useRef(false)
  const level = LEVEL_META.find(l => l.level === target)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="levelup"
      onClose={() => { if (!handledRef.current) onDecline() }}
      onClick={e => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="levelup__inner">
        <span className="levelup__icon" aria-hidden="true">🎉</span>
        <h2 className="levelup__title">Świetnie Ci idzie</h2>
        <p className="levelup__sub">
          Twój poziom to teraz <strong>{level?.name ?? `Poziom ${target}`}</strong>.
          Ustawić go jako domyślny?
        </p>
        <p className="levelup__note">
          Nadal czasem wrócimy do łatwiejszych słów dla utrwalenia — ale na co
          dzień będziemy proponować trudniejsze treści.
        </p>
        <div className="levelup__actions">
          <button
            className="levelup__btn levelup__btn--primary"
            onClick={() => { handledRef.current = true; onAccept(); ref.current?.close() }}
          >
            Tak, podnieś
          </button>
          <button
            className="levelup__btn"
            onClick={() => { handledRef.current = true; onDecline(); ref.current?.close() }}
          >
            Jeszcze nie
          </button>
        </div>
      </div>
    </dialog>
  )
}
