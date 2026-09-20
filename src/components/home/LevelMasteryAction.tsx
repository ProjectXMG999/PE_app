import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { Sheet, useSheetMotion, type SheetHandle } from '../shared/Sheet'
import {
  markLevelMastered, unmarkLevelMastered, LevelMasteryProgress, LevelMasteryFetchError,
} from '../../services/levelMastery'
import { showToast } from '../../services/toast'
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

type Stage = 'idle' | 'confirm-mark' | 'marking' | 'confirm-unmark' | 'unmarking' | 'error'

/** Which action failed — the error screen offers to run that one again. */
type FailedAction = 'mark' | 'unmark'

/**
 * Why a declaration failed, in the user's language.
 *
 * Every one of these used to be swallowed: `handleMark` had a `finally` and no
 * `catch`, so a rejected fetch put the button back exactly as it was and left
 * the console as the only evidence that anything had happened at all.
 */
function failureMessage(err: unknown): string {
  if (err instanceof LevelMasteryFetchError) {
    const { failed, total, status } = err
    if (status === 401) {
      return 'Twoja sesja wygasła. Zaloguj się ponownie i spróbuj jeszcze raz — nic nie zostało zmienione.'
    }
    if (status === 402) {
      return 'Twój dostęp do paczek wygasł, więc nie udało się ich pobrać. Nic nie zostało zmienione.'
    }
    return `Nie udało się pobrać ${failed.length} z ${total} ${plural(total, 'paczki', 'paczek')}`
      + `${status ? ` (błąd ${status})` : ''}. Nic nie zostało zmienione — sprawdź połączenie i spróbuj ponownie.`
  }
  const detail = err instanceof Error ? err.message : String(err)
  return `Nie udało się dokończyć operacji. Szczegóły: ${detail}`
}

function plural(n: number, few: string, many: string): string {
  return n === 1 ? few : many
}

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
  const [failure, setFailure] = useState<{ action: FailedAction; message: string } | null>(null)
  const sheet = useRef<SheetHandle>(null)
  const mountedRef = useRef(true)
  const { rise, tap } = useSheetMotion()
  useEffect(() => () => { mountedRef.current = false }, [])

  /** Mounting the sheet IS opening it — it shows itself and plays its arrival.
   *  While one is already open (a failure arriving mid-run), this only swaps
   *  which stage is on screen. */
  function openDialog(next: Exclude<Stage, 'idle'>) {
    setStage(next)
  }

  async function handleMark() {
    setStage('marking')
    setProgress({ loaded: 0, total })
    try {
      await markLevelMastered(level, p => { if (mountedRef.current) setProgress(p) })
      if (!mountedRef.current) return
      // The sheet plays its exit and reports back through onClose, which is
      // what returns the stage to idle — clearing it here would cut the
      // animation off at the first frame.
      sheet.current?.close()
      onMarked()
      // The whole point of the toast: on a level you had already worked
      // through, the declaration moves no counter anywhere on the page. The
      // badge alone is a quiet grey line, and a change that small reads as
      // nothing having happened.
      showToast(`„${levelName}" oznaczony jako opanowany.`, { icon: '✓' })
    } catch (err) {
      if (!mountedRef.current) return
      setProgress(null)
      setFailure({ action: 'mark', message: failureMessage(err) })
      openDialog('error')
    }
  }

  async function handleUnmark() {
    setStage('unmarking')
    try {
      await unmarkLevelMastered(level)
      if (!mountedRef.current) return
      sheet.current?.close()
      onUnmarked()
      showToast(`Cofnięto oznaczenie „${levelName}".`, { icon: '↩' })
    } catch (err) {
      if (!mountedRef.current) return
      setFailure({ action: 'unmark', message: failureMessage(err) })
      openDialog('error')
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
            onClick={() => openDialog('confirm-unmark')}
            disabled={busy}
          >
            {stage === 'unmarking' ? 'Cofanie…' : 'Cofnij'}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="lvl-mastery__btn"
          onClick={() => openDialog('confirm-mark')}
          disabled={busy}
        >
          Oznacz poziom jako opanowany
        </button>
      )}

      {stage !== 'idle' && (
        <Sheet
          ref={sheet}
          onClose={() => { setStage('idle'); setProgress(null) }}
          className="lvl-mastery-modal"
          aria-label={levelName}
          /* Escape used to dismiss the progress dialog mid-run: the work kept
             going invisibly and finished minutes later with the page seemingly
             untouched — another way this control looked like it did nothing.
             Nothing dismisses this sheet while it is writing: not Escape, not
             the backdrop, not a flick down. */
          dismissible={!busy}
        >
          {stage === 'error' ? (
            <>
              <motion.h2 className="lvl-mastery-modal__title" variants={rise}>Nie udało się</motion.h2>
              <motion.p className="lvl-mastery-modal__desc" variants={rise}>{failure?.message}</motion.p>
              <motion.div className="lvl-mastery-modal__actions" variants={rise}>
                <motion.button
                  type="button"
                  className="lvl-mastery-modal__btn lvl-mastery-modal__btn--cancel"
                  whileTap={tap}
                  onClick={() => sheet.current?.close()}
                >
                  Zamknij
                </motion.button>
                <motion.button
                  type="button"
                  className="lvl-mastery-modal__btn lvl-mastery-modal__btn--confirm"
                  whileTap={tap}
                  onClick={() => (failure?.action === 'unmark' ? handleUnmark() : handleMark())}
                >
                  Spróbuj ponownie
                </motion.button>
              </motion.div>
            </>
          ) : stage === 'marking' ? (
            <>
              <motion.h2 className="lvl-mastery-modal__title" variants={rise}>Oznaczanie „{levelName}"…</motion.h2>
              <motion.p className="lvl-mastery-modal__desc" variants={rise}>
                Pobieranie słów: {progress?.loaded ?? 0} / {progress?.total ?? total} paczek.
                Przy dużym poziomie może to potrwać do minuty.
              </motion.p>
              <motion.progress
                className="lvl-mastery-modal__progress"
                variants={rise}
                value={progress?.loaded ?? 0}
                max={progress?.total ?? total}
              />
            </>
          ) : stage === 'confirm-mark' ? (
            <>
              <motion.h2 className="lvl-mastery-modal__title" variants={rise}>
                Oznaczyć „{levelName}" jako opanowany?
              </motion.h2>
              <motion.p className="lvl-mastery-modal__desc" variants={rise}>
                Wszystkie {total.toLocaleString('pl-PL')} słów tego poziomu zostaną oznaczone jako znane
                i znikną z powtórek na stałe — dopóki nie klikniesz „Cofnij". Nie wpłynie to na Twoje
                tempo, punkty ani odznaki: to deklaracja, nie wysiłek.
              </motion.p>
              <motion.div className="lvl-mastery-modal__actions" variants={rise}>
                <motion.button
                  type="button"
                  className="lvl-mastery-modal__btn lvl-mastery-modal__btn--cancel"
                  whileTap={tap}
                  onClick={() => sheet.current?.close()}
                >
                  Anuluj
                </motion.button>
                <motion.button
                  type="button"
                  className="lvl-mastery-modal__btn lvl-mastery-modal__btn--confirm"
                  whileTap={tap}
                  onClick={handleMark}
                >
                  Oznacz
                </motion.button>
              </motion.div>
            </>
          ) : (
            <>
              <motion.h2 className="lvl-mastery-modal__title" variants={rise}>
                Cofnąć oznaczenie „{levelName}"?
              </motion.h2>
              <motion.p className="lvl-mastery-modal__desc" variants={rise}>
                Każde słowo i każda paczka tego poziomu wrócą dokładnie do stanu sprzed oznaczenia —
                łącznie ze słowami, które miały już realny postęp.
              </motion.p>
              <motion.div className="lvl-mastery-modal__actions" variants={rise}>
                <motion.button
                  type="button"
                  className="lvl-mastery-modal__btn lvl-mastery-modal__btn--cancel"
                  whileTap={tap}
                  onClick={() => sheet.current?.close()}
                  disabled={busy}
                >
                  Anuluj
                </motion.button>
                <motion.button
                  type="button"
                  className="lvl-mastery-modal__btn lvl-mastery-modal__btn--confirm"
                  whileTap={tap}
                  onClick={handleUnmark}
                  disabled={busy}
                >
                  {stage === 'unmarking' ? 'Cofanie…' : 'Cofnij'}
                </motion.button>
              </motion.div>
            </>
          )}
        </Sheet>
      )}

    </div>
  )
}
