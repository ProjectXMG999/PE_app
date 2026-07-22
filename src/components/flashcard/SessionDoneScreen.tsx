import './SessionDoneScreen.css'

interface Props {
  packName: string
  /** Words marked known in this session. */
  sessionKnown: number
  /** Total known words in the pack. */
  packKnown: number
  /** Pack size. */
  packTotal: number
  onRepeat: () => void
  onNext: (() => void) | null
  nextPackName?: string
  onExit: () => void
}

/**
 * Shown when a Word-Flash session finishes without mastering the whole pack.
 * Mirrors MasteryScreen's premium language (glass card, rise animation, pill
 * actions) but in a calmer green "session complete" theme — the gold trophy
 * stays reserved for full mastery.
 */
export function SessionDoneScreen({
  packName,
  sessionKnown,
  packKnown,
  packTotal,
  onRepeat,
  onNext,
  nextPackName,
  onExit,
}: Props) {
  return (
    <div className="sessiondone">
      <div className="sessiondone__content" role="dialog" aria-label="Sesja zakończona">
        <div className="sessiondone__badge">
          <span className="sessiondone__ring" aria-hidden="true" />
          <span className="sessiondone__medal">
            <svg className="sessiondone__check" viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        </div>

        <div className="sessiondone__text">
          <p className="sessiondone__eyebrow">Sesja zakończona</p>
          <h1 className="sessiondone__title">Dobra robota!</h1>
          <p className="sessiondone__sub">{packName}</p>
        </div>

        <div className="sessiondone__stats">
          {sessionKnown > 0 && (
            <span className="sessiondone__chip">
              <span className="sessiondone__chip-plus">+{sessionKnown}</span>
              w tej sesji
            </span>
          )}
          <span className="sessiondone__progress">
            {packKnown} / {packTotal} opanowanych
          </span>
        </div>

        <div className="sessiondone__actions">
          <button className="sessiondone__btn sessiondone__btn--repeat" onClick={onRepeat}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            <span>Powtórz</span>
          </button>
          {onNext ? (
            <button className="sessiondone__btn sessiondone__btn--next" onClick={onNext}>
              <span className="sessiondone__btn-label">{nextPackName ?? 'Następna paczka'}</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          ) : (
            <button className="sessiondone__btn sessiondone__btn--next" onClick={onExit}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 10.5 9-7 9 7" />
                <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
              </svg>
              <span>Strona główna</span>
            </button>
          )}
        </div>

        {onNext && (
          <button className="sessiondone__exit" onClick={onExit}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 10.5 9-7 9 7" />
              <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
            </svg>
            Wróć do strony głównej
          </button>
        )}
      </div>
    </div>
  )
}
