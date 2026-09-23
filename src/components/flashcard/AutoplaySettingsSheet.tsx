import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Sheet, useSheetMotion, type SheetHandle } from '../shared/Sheet'
import { Toggle } from '../settings/PrefsList'
import { useAppStore } from '../../store/useAppStore'
import { RATES } from '../../constants/audioRates'
import { SPRING_SNAPPY } from '../today/motion'
import './AutoplaySettingsSheet.css'

interface Props {
  onClose: () => void
}

/**
 * Bottom sheet with the live controls for a running listening session: playback
 * speed and the background pad. Deliberately does NOT pause playback — rates
 * apply from the next clip, so the user tunes while listening.
 *
 * The speed pills are a segmented control like the goal picker's: one thumb
 * slides to the rate you picked. You are adjusting something that is running,
 * and a marker that travels says "this one now" far better than two pills
 * swapping colour while audio plays on.
 *
 * The pad switch is the same store value as the one in Ustawienia, not a
 * session-local copy — someone who turns the pad off mid-session means it, and
 * finding it back on tomorrow would read as the switch not having worked. It
 * takes effect immediately: FlashcardPage keys the pad off this flag, so the
 * drone fades out under the finger rather than at the next card.
 */
export function AutoplaySettingsSheet({ onClose }: Props) {
  // Atomic selectors — see the note in App.tsx.
  const enRate = useAppStore(s => s.enRate)
  const plRate = useAppStore(s => s.plRate)
  const setEnRate = useAppStore(s => s.setEnRate)
  const setPlRate = useAppStore(s => s.setPlRate)
  const studyPadEnabled = useAppStore(s => s.studyPadEnabled)
  const setStudyPadEnabled = useAppStore(s => s.setStudyPadEnabled)
  const sheet = useRef<SheetHandle>(null)
  const { reduced, rise, tap } = useSheetMotion()

  function rateRow(
    id: string,
    name: string,
    hint: string,
    groupLabel: string,
    current: number,
    set: (v: number) => void,
  ) {
    return (
      <motion.div className="aps-sheet__row" variants={rise}>
        <div className="aps-sheet__row-label">
          <span className="aps-sheet__row-name">{name}</span>
          <span className="aps-sheet__row-hint">{hint}</span>
        </div>
        <div className="aps-sheet__pills" role="radiogroup" aria-label={groupLabel}>
          {RATES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={current === value}
              className={`aps-sheet__pill ${current === value ? 'aps-sheet__pill--active' : ''}`}
              onClick={() => set(value)}
            >
              {current === value && (
                <motion.span
                  layoutId={`aps-thumb-${id}`}
                  className="aps-sheet__pill-thumb"
                  aria-hidden="true"
                  transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
                />
              )}
              <span className="aps-sheet__pill-label">{label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    )
  }

  return (
    <Sheet
      ref={sheet}
      onClose={onClose}
      className="aps-sheet"
      aria-labelledby="aps-sheet-title"
    >
      <motion.div className="aps-sheet__header" variants={rise}>
        <h2 className="aps-sheet__title" id="aps-sheet-title">Ustawienia odtwarzania</h2>
        <motion.button
          type="button"
          className="aps-sheet__close"
          whileTap={tap}
          onClick={() => sheet.current?.close()}
          aria-label="Zamknij"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </motion.button>
      </motion.div>

      {rateRow('en', 'Tempo angielskiego', 'słowa i zdania EN', 'Tempo audio angielskiego', enRate, setEnRate)}
      {rateRow('pl', 'Tempo polskiego', 'słowa i zdania PL', 'Tempo audio polskiego', plRate, setPlRate)}

      <motion.div className="aps-sheet__row aps-sheet__row--inline" variants={rise}>
        <div className="aps-sheet__row-label">
          <span className="aps-sheet__row-name">Muzyka w tle</span>
          <span className="aps-sheet__row-hint">Cichy oddech w przerwach między nagraniami</span>
        </div>
        <Toggle on={studyPadEnabled} onChange={setStudyPadEnabled} label="Muzyka w tle" />
      </motion.div>

      <motion.p className="aps-sheet__note" variants={rise}>
        Tempo działa od następnego nagrania
      </motion.p>
    </Sheet>
  )
}
