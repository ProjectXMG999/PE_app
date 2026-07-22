import { useState, useRef, useEffect } from 'react'
import { PackMeta } from '../../types/vocabulary'
import packagesIndex from '../../data/packages-index.json'
import { resetAllProgress, resetProgressForPackages } from '../../services/db'
import { invalidateProgressSnapshot } from '../../hooks/useProgressData'
import './ResetProgressModal.css'

const allPacks = packagesIndex as PackMeta[]
const VOLUMES = [...new Set(allPacks.map(p => p.volume))].sort()
const LEVELS = [...new Set(allPacks.map(p => p.level))].filter(Boolean).sort() as number[]

type Scope = 'all' | `volume:${string}` | `level:${number}`

function scopeLabel(scope: Scope): string {
  if (scope === 'all') return 'całego progresu'
  if (scope.startsWith('volume:')) return `tomu "${scope.slice(7)}"`
  if (scope.startsWith('level:')) return `poziomu ${scope.slice(6)}`
  return ''
}

function getPackageIds(scope: Scope): string[] {
  if (scope === 'all') return allPacks.map(p => p.id)
  if (scope.startsWith('volume:')) {
    const vol = scope.slice(7)
    return allPacks.filter(p => p.volume === vol).map(p => p.id)
  }
  if (scope.startsWith('level:')) {
    const lvl = parseInt(scope.slice(6), 10)
    return allPacks.filter(p => p.level === lvl).map(p => p.id)
  }
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
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const CONFIRM_WORD = 'RESETUJ'
  const canConfirm = confirmText === CONFIRM_WORD && !busy

  // Native <dialog> supplies the focus trap and ESC-to-close (as a 'cancel'
  // then 'close' event); we just funnel 'close' back to the onClose prop.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    inputRef.current?.focus()
    dialog.addEventListener('close', onClose)
    return () => dialog.removeEventListener('close', onClose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleReset() {
    if (!canConfirm) return
    setBusy(true)
    try {
      if (scope === 'all') {
        await resetAllProgress()
        // Reset onboarding flags when resetting all progress
        localStorage.removeItem('lp_onboarding_seen')
        localStorage.removeItem('lp_onboarding_card_hidden')
      } else {
        await resetProgressForPackages(getPackageIds(scope))
      }
      invalidateProgressSnapshot()
      onReset()
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="reset-modal"
      aria-labelledby="reset-modal-title"
      onClick={e => { if (e.target === dialogRef.current) dialogRef.current?.close() }}
    >
        <div className="reset-modal__icon" aria-hidden="true">⚠️</div>
        <h2 className="reset-modal__title" id="reset-modal-title">Resetuj progres</h2>
        <p className="reset-modal__desc">
          Nieodwracalna operacja. Wybierz zakres, wpisz <strong>{CONFIRM_WORD}</strong> i potwierdź.
        </p>

        <div className="reset-modal__field">
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
        </div>

        <div className="reset-modal__field">
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
        </div>

        <div className="reset-modal__summary">
          Zresetujesz progres {scopeLabel(scope)} —{' '}
          <strong>{getPackageIds(scope).length}</strong> paczek
        </div>

        <div className="reset-modal__actions">
          <button className="reset-modal__btn reset-modal__btn--cancel" onClick={() => dialogRef.current?.close()} disabled={busy}>
            Anuluj
          </button>
          <button
            className="reset-modal__btn reset-modal__btn--confirm"
            onClick={handleReset}
            disabled={!canConfirm}
          >
            {busy ? 'Resetowanie…' : 'Resetuj'}
          </button>
        </div>
    </dialog>
  )
}
