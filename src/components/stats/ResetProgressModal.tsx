import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sheet, useSheetMotion, type SheetHandle } from '../shared/Sheet'
import { PackMeta } from '../../types/vocabulary'
import packagesIndex from '../../data/packages-index.json'
import { resetAllProgress, resetProgressForPackages } from '../../services/db'
import { packageIdsForLevel, masteryLevels } from '../../services/levelMastery'
import { invalidateProgressSnapshot } from '../../hooks/useProgressData'
import { plPacks } from '../../utils/plural'
import './ResetProgressModal.css'

const allPacks = packagesIndex as PackMeta[]
// Route order, not sorted: `packages-index.json` is already the curriculum
// order (packRoute.ts), and `[].sort()` on "Tom I…Tom IX" is lexicographic —
// it only happens to agree with the route for these nine labels.
const VOLUMES = [...new Set(allPacks.map(p => p.volume))]
const LEVELS = masteryLevels()

type Scope = 'all' | `volume:${string}` | `level:${number}`

/** The whole object of "Zresetujesz …", not just its tail: the tail form gave
 *  "Zresetujesz progres całego progresu" on the scope people pick most. */
function scopeLabel(scope: Scope): string {
  if (scope === 'all') return 'cały progres'
  // The volume id already carries the word ("Tom II"), so the numeral alone
  // goes into the sentence — "progres tomu Tom II" was the literal alternative.
  if (scope.startsWith('volume:')) return `progres tomu ${scope.slice(7).replace(/^Tom\s+/, '')}`
  if (scope.startsWith('level:')) return `progres poziomu ${scope.slice(6)}`
  return ''
}

function getPackageIds(scope: Scope): string[] {
  if (scope === 'all') return allPacks.map(p => p.id)
  if (scope.startsWith('volume:')) {
    const vol = scope.slice(7)
    return allPacks.filter(p => p.volume === vol).map(p => p.id)
  }
  // The same list "Oznacz poziom jako opanowany" acts on — see the note on
  // packageIdsForLevel for why it is not `p.level === lvl`.
  if (scope.startsWith('level:')) return packageIdsForLevel(parseInt(scope.slice(6), 10))
  return []
}

interface Props {
  onClose: () => void
  onReset: () => void
}

export function ResetProgressModal({ onClose, onReset }: Props) {
  const [scope, setScope] = useState<Scope>('all')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sheet = useRef<SheetHandle>(null)
  const { rise, tap } = useSheetMotion()

  const CONFIRM_WORD = 'RESETUJ'
  const canConfirm = confirmText === CONFIRM_WORD && !busy
  /** The exact set the confirm button will act on — the summary quotes its
   *  size, so it must be the same list `handleReset` passes down, not a
   *  second walk of the index that could drift from it. */
  const scopedPackIds = getPackageIds(scope)

  // The confirmation field is where this dialog starts — the sheet itself
  // handles focus trapping, Escape and the close event.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleReset() {
    if (!canConfirm) return
    setBusy(true)
    setError(null)
    try {
      if (scope === 'all') {
        await resetAllProgress()
        // Reset onboarding flags when resetting all progress
        localStorage.removeItem('lp_onboarding_seen')
        localStorage.removeItem('lp_onboarding_card_hidden')
      } else {
        await resetProgressForPackages(scopedPackIds)
      }
      invalidateProgressSnapshot()
      onReset()
    } catch (err) {
      // The reset clears the server side first and stops if that fails, so
      // nothing has been touched — saying "gotowe" here would be a lie that
      // the next sign-in exposes by handing the whole account back.
      console.error('[reset] failed:', err)
      setError('Nie udało się wyczyścić progresu na serwerze, więc nic nie zostało skasowane. Sprawdź połączenie i spróbuj ponownie.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      ref={sheet}
      onClose={onClose}
      className="reset-modal"
      aria-labelledby="reset-modal-title"
      /* Mid-reset there is no safe way out: no backdrop tap, no Escape, no
         flick. The operation clears the server first and the UI has to stay
         put until it either lands or fails. */
      dismissible={!busy}
    >
      <motion.div className="reset-modal__icon" variants={rise} aria-hidden="true">⚠️</motion.div>
      <motion.h2 className="reset-modal__title" id="reset-modal-title" variants={rise}>
        Resetuj progres
      </motion.h2>
      <motion.p className="reset-modal__desc" variants={rise}>
        Nieodwracalna operacja. Wybierz zakres, wpisz <strong>{CONFIRM_WORD}</strong> i potwierdź.
      </motion.p>

      <motion.div className="reset-modal__field" variants={rise}>
        <label className="reset-modal__label" htmlFor="reset-scope">Zakres</label>
        <select
          id="reset-scope"
          className="reset-modal__select"
          value={scope}
          onChange={e => { setScope(e.target.value as Scope); setConfirmText('') }}
        >
          <option value="all">Wszystko</option>
          <optgroup label="Tom">
            {VOLUMES.map(v => (
              <option key={v} value={`volume:${v}`}>{v}</option>
            ))}
          </optgroup>
          <optgroup label="Poziom">
            {LEVELS.map(l => (
              <option key={l} value={`level:${l}`}>Poziom {l}</option>
            ))}
          </optgroup>
        </select>
      </motion.div>

      <motion.div className="reset-modal__field" variants={rise}>
        <label className="reset-modal__label" htmlFor="reset-confirm">
          Wpisz <strong>{CONFIRM_WORD}</strong> aby potwierdzić
        </label>
        <input
          id="reset-confirm"
          ref={inputRef}
          className="reset-modal__input"
          type="text"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value.toUpperCase())}
          placeholder={CONFIRM_WORD}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </motion.div>

      <motion.div className="reset-modal__summary" variants={rise}>
        Zresetujesz {scopeLabel(scope)} —{' '}
        <strong>{scopedPackIds.length}</strong> {plPacks(scopedPackIds.length)}
      </motion.div>

      {error && <p className="reset-modal__error" role="alert">{error}</p>}

      <motion.div className="reset-modal__actions" variants={rise}>
        <motion.button
          type="button"
          className="reset-modal__btn reset-modal__btn--cancel"
          whileTap={tap}
          onClick={() => sheet.current?.close()}
          disabled={busy}
        >
          Anuluj
        </motion.button>
        <motion.button
          type="button"
          className="reset-modal__btn reset-modal__btn--confirm"
          whileTap={canConfirm ? tap : undefined}
          onClick={handleReset}
          disabled={!canConfirm}
        >
          {busy ? 'Resetowanie…' : 'Resetuj'}
        </motion.button>
      </motion.div>
    </Sheet>
  )
}
