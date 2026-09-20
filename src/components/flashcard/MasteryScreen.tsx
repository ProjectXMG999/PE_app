import { Suspense, lazy, useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Confetti } from '../shared/Confetti'
import { useBack } from '../../navigation/navigation'
import './MasteryScreen.css'

/** The one screen in the app that gets a shader of its own — see MasteryField
 *  for why it can afford one and why the glass here needed it. */
const MasteryField = lazy(() => import('./MasteryField'))

const RAY_TOKENS = ['--rays-1', '--rays-2', '--rays-3']

/** Read if the tokens can't be: the dark reward palette, so a failure still
 *  looks like the app. */
const FALLBACK_RAYS = ['#ebbd57', '#ad8031', '#a88dff']

function readRayColors(): string[] {
  const cs = getComputedStyle(document.documentElement)
  const colors = RAY_TOKENS.map(t => cs.getPropertyValue(t).trim())
  return colors.every(Boolean) ? colors : FALLBACK_RAYS
}

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
  const reduced = useReducedMotion()

  // Held back one frame so the card's entrance animation owns the first
  // moment: the rays fade up behind a card that is already rising, rather
  // than everything arriving at once. The colours are read at mount — this
  // screen is short-lived, so it doesn't need the live theme observer the
  // ambient background carries.
  const [lit, setLit] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setLit(true), 180)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="mastery">
      <div className={`mastery__rays${lit ? ' mastery__rays--lit' : ''}`} aria-hidden="true">
        {lit && (
          <Suspense fallback={null}>
            <MasteryField colors={readRayColors()} still={!!reduced} />
          </Suspense>
        )}
      </div>

      <Confetti className="mastery__canvas" />

      <div className="mastery__content u-liquid" role="dialog" aria-label="Paczka opanowana">
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
