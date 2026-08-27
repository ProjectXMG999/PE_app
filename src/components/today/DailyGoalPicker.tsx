import { useEffect, useRef } from 'react'
import { DAILY_GOAL_OPTIONS, useAppStore } from '../../store/useAppStore'
import './DailyGoalPicker.css'

interface Props {
  onClose: () => void
}

/**
 * Daily goal, as a short list of pills rather than a slider.
 *
 * A slider asks the user to aim; six options ask them to choose. The list also
 * makes the realistic range explicit — the point is a goal that survives a bad
 * week, not the highest number they can drag to on day one.
 */
export function DailyGoalPicker({ onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const dailyGoalSec = useAppStore(s => s.dailyGoalSec)
  const setDailyGoalSec = useAppStore(s => s.setDailyGoalSec)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="goalpicker"
      onClose={onClose}
      onClick={e => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="goalpicker__inner">
        <span className="goalpicker__handle" aria-hidden="true" />

        <h2 className="goalpicker__title">Cel na dzień</h2>
        <p className="goalpicker__sub">
          Ile minut dziennie chcesz trenować? Lepszy mniejszy cel, który utrzymasz.
        </p>

        <div className="goalpicker__options" role="radiogroup" aria-label="Cel na dzień">
          {DAILY_GOAL_OPTIONS.map(min => {
            const sec = min * 60
            const active = sec === dailyGoalSec
            return (
              <button
                key={min}
                role="radio"
                aria-checked={active}
                className={`goalpicker__option${active ? ' goalpicker__option--active' : ''}`}
                onClick={() => setDailyGoalSec(sec)}
              >
                <span className="goalpicker__option-value">{min}</span>
                <span className="goalpicker__option-unit">min</span>
              </button>
            )
          })}
        </div>

        <button className="goalpicker__done" onClick={() => ref.current?.close()}>
          Gotowe
        </button>
      </div>
    </dialog>
  )
}
