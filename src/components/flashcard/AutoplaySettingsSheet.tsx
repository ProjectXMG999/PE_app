import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { RATES } from '../../constants/audioRates'
import './AutoplaySettingsSheet.css'

interface Props {
  onClose: () => void
}

// Bottom sheet with live playback-speed controls. Deliberately does NOT pause
// playback — rates apply from the next clip, so the user tunes while listening.
export function AutoplaySettingsSheet({ onClose }: Props) {
  const { enRate, plRate, setEnRate, setPlRate } = useAppStore()
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Native <dialog> supplies the focus trap and ESC-to-close (as a 'cancel'
  // then 'close' event); we just funnel 'close' back to the onClose prop.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    dialog.addEventListener('close', onClose)
    return () => dialog.removeEventListener('close', onClose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="aps-sheet"
      aria-labelledby="aps-sheet-title"
      onClick={e => { if (e.target === dialogRef.current) dialogRef.current?.close() }}
    >
      <div className="aps-sheet__handle" aria-hidden="true" />
      <div className="aps-sheet__header">
        <h2 className="aps-sheet__title" id="aps-sheet-title">Ustawienia odtwarzania</h2>
        <button className="aps-sheet__close" onClick={() => dialogRef.current?.close()} aria-label="Zamknij">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="aps-sheet__row">
        <div className="aps-sheet__row-label">
          <span className="aps-sheet__row-name">Tempo angielskiego</span>
          <span className="aps-sheet__row-hint">słowa i zdania EN</span>
        </div>
        <div className="aps-sheet__pills" role="radiogroup" aria-label="Tempo audio angielskiego">
          {RATES.map(({ value, label }) => (
            <button
              key={value}
              role="radio"
              aria-checked={enRate === value}
              className={`aps-sheet__pill ${enRate === value ? 'aps-sheet__pill--active' : ''}`}
              onClick={() => setEnRate(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="aps-sheet__row">
        <div className="aps-sheet__row-label">
          <span className="aps-sheet__row-name">Tempo polskiego</span>
          <span className="aps-sheet__row-hint">słowa i zdania PL</span>
        </div>
        <div className="aps-sheet__pills" role="radiogroup" aria-label="Tempo audio polskiego">
          {RATES.map(({ value, label }) => (
            <button
              key={value}
              role="radio"
              aria-checked={plRate === value}
              className={`aps-sheet__pill ${plRate === value ? 'aps-sheet__pill--active' : ''}`}
              onClick={() => setPlRate(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="aps-sheet__note">Zmiany działają od następnego nagrania</p>
    </dialog>
  )
}
