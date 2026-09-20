import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { markLevelMastered, unmarkLevelMastered, LevelMasteryProgress } from '../../services/levelMastery'
import './LevelMasteryAction.css'

interface Props {
  level: number
  levelName: string
  color: string
  total: number
  marked: boolean
  onMarked: () => void
  onUnmarked: () => void
}

type Stage = 'idle' | 'confirm-mark' | 'marking' | 'confirm-unmark' | 'unmarking'

/**
 * "Oznacz cały poziom jako opanowany" / "Cofnij" — a declaration, not a study
 * session: it never touches tempo/points/achievements (services/review.ts
 * `isDeclaredKnownWord` keeps those honest), but it DOES count toward the
 * route/coverage the moment it lands (useProgressData reads WordProgress
 * status directly), and it permanently retires every word in the level out of
 * `/powtorka` until this same control is used to undo it.
 */
export function LevelMasteryAction({ level, levelName, color, total, marked, onMarked, onUnmarked }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState<LevelMasteryProgress | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mountedRef = useRef(true)

  function openConfirm(next: 'confirm-mark' | 'confirm-unmark') {
    setStage(next)
    requestAnimationFrame(() => dialogRef.current?.showModal())
  }

  async function handleMark() {
    setStage('marking')
    setProgress({ loaded: 0, total })
    try {
      await markLevelMastered(level, p => { if (mountedRef.current) setProgress(p) })
      dialogRef.current?.close()
      onMarked()
    } finally {
      if (mountedRef.current) { setStage('idle'); setProgress(null) }
    }
  }

  async function handleUnmark() {
    setStage('unmarking')
    try {
      await unmarkLevelMastered(level)
      dialogRef.current?.close()
      onUnmarked()
    } finally {
      if (mountedRef.current) setStage('idle')
    }
  }

  const busy = stage === 'marking' || stage === 'unmarking'

  return (
    <div className="lvl-mastery" style={{ '--lvl': color } as CSSProperties}>
      {marked ? (
        <>
          <span className="lvl-mastery__badge">✓ Poziom opanowany</span>
          <button
            type="button"
            className="lvl-mastery__btn lvl-mastery__btn--undo"
            onClick={() => openConfirm('confirm-unmark')}
            disabled={busy}
          >
            {stage === 'unmarking' ? 'Cofanie…' : 'Cofnij'}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="lvl-mastery__btn"
          onClick={() => openConfirm('confirm-mark')}
          disabled={busy}
        >
          Oznacz poziom jako opanowany
        </button>
      )}

      {stage !== 'idle' && (
        <dialog
          ref={dialogRef}
          className="lvl-mastery-modal"
          onClick={e => { if (e.target === dialogRef.current && !busy) dialogRef.current?.close() }}
          onClose={() => setStage('idle')}
        >
          {stage === 'marking' ? (
            <>
              <h2 className="lvl-mastery-modal__title">Oznaczanie „{levelName}"…</h2>
              <p className="lvl-mastery-modal__desc">
                Pobieranie słów: {progress?.loaded ?? 0} / {progress?.total ?? total} paczek.
                Przy dużym poziomie może to potrwać do minuty.
              </p>
              <progress
                className="lvl-mastery-modal__progress"
                value={progress?.loaded ?? 0}
                max={progress?.total ?? total}
              />
            </>
          ) : stage === 'confirm-mark' ? (
            <>
              <h2 className="lvl-mastery-modal__title">Oznaczyć „{levelName}" jako opanowany?</h2>
              <p className="lvl-mastery-modal__desc">
                Wszystkie {total.toLocaleString('pl-PL')} słów tego poziomu zostaną oznaczone jako znane
                i znikną z powtórek na stałe — dopóki nie klikniesz „Cofnij". Nie wpłynie to na Twoje
                tempo, punkty ani odznaki: to deklaracja, nie wysiłek.
              </p>
              <div className="lvl-mastery-modal__actions">
                <button
                  className="lvl-mastery-modal__btn lvl-mastery-modal__btn--cancel"
                  onClick={() => dialogRef.current?.close()}
                >
                  Anuluj
                </button>
                <button className="lvl-mastery-modal__btn lvl-mastery-modal__btn--confirm" onClick={handleMark}>
                  Oznacz
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="lvl-mastery-modal__title">Cofnąć oznaczenie „{levelName}"?</h2>
              <p className="lvl-mastery-modal__desc">
                Każde słowo i każda paczka tego poziomu wrócą dokładnie do stanu sprzed oznaczenia —
                łącznie ze słowami, które miały już realny postęp.
              </p>
              <div className="lvl-mastery-modal__actions">
                <button
                  className="lvl-mastery-modal__btn lvl-mastery-modal__btn--cancel"
                  onClick={() => dialogRef.current?.close()}
                >
                  Anuluj
                </button>
                <button className="lvl-mastery-modal__btn lvl-mastery-modal__btn--confirm" onClick={handleUnmark}>
                  Cofnij
                </button>
              </div>
            </>
          )}
        </dialog>
      )}
    </div>
  )
}
