import { Confetti } from '../shared/Confetti'
import { useBack } from '../../navigation/navigation'
import './MasteryScreen.css'

interface Props {
  packName: string
  onRepeat: () => void
  onNext: (() => void) | null
  nextPackName?: string
  onExit: () => void
}

export function MasteryScreen({ packName, onRepeat, onNext, nextPackName, onExit }: Props) {
  // Only the wording: the caller decides what onExit does.
  const { label, backLabel } = useBack()
  return (
    <div className="mastery">
      <Confetti className="mastery__canvas" />

      <div className="mastery__content" role="dialog" aria-label="Paczka opanowana">
        <div className="mastery__badge">
          <span className="mastery__ring" aria-hidden="true" />
          <span className="mastery__ring mastery__ring--inner" aria-hidden="true" />
          <span className="mastery__medal">
            <span className="mastery__trophy" aria-hidden="true">🏆</span>
          </span>
          <div className="mastery__stars" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <span key={i} className="mastery__star" style={{ '--i': i } as React.CSSProperties}>★</span>
            ))}
          </div>
        </div>

        <div className="mastery__text">
          <p className="mastery__eyebrow">Paczka opanowana</p>
          <h1 className="mastery__title">Brawo!</h1>
          <p className="mastery__sub">{packName}</p>
        </div>

        <div className="mastery__actions">
          <button className="mastery__btn mastery__btn--repeat" onClick={onRepeat}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            <span>Od nowa</span>
          </button>
          {onNext ? (
            <button className="mastery__btn mastery__btn--next" onClick={onNext}>
              <span className="mastery__btn-label">{nextPackName ?? 'Następna paczka'}</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          ) : (
            <button className="mastery__btn mastery__btn--next" onClick={onExit}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 10.5 9-7 9 7" />
                <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
              </svg>
              <span>{label}</span>
            </button>
          )}
        </div>

        {onNext && (
          <button className="mastery__exit" onClick={onExit}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 10.5 9-7 9 7" />
              <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
            </svg>
            {backLabel}
          </button>
        )}
      </div>
    </div>
  )
}
