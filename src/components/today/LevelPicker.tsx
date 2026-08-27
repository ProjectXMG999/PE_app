import { useEffect, useRef } from 'react'
import { LEVEL_COLORS, LEVEL_META } from '../../data/levels'
import './LevelPicker.css'

interface Props {
  current: number | null
  onSelect: (level: number) => void
  onClose: () => void
}

/**
 * Where to start the route from — a one-time choice for anyone who isn't a
 * true beginner. Sets the floor the Dziś recommendation searches from, so a
 * returning learner isn't offered Level 1, word 1.
 */
export function LevelPicker({ current, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="levelpicker"
      onClose={onClose}
      onClick={e => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="levelpicker__inner">
        <span className="levelpicker__handle" aria-hidden="true" />

        <h2 className="levelpicker__title">Od którego poziomu zacząć?</h2>
        <p className="levelpicker__sub">
          Progress zacznie proponować paczki od tego miejsca w trasie.
        </p>

        <div className="levelpicker__options" role="radiogroup" aria-label="Poziom startowy">
          {LEVEL_META.map(l => {
            const active = l.level === current
            return (
              <button
                key={l.level}
                role="radio"
                aria-checked={active}
                className={`levelpicker__option${active ? ' levelpicker__option--active' : ''}`}
                onClick={() => onSelect(l.level)}
              >
                <span
                  className="levelpicker__option-dot"
                  style={{ background: LEVEL_COLORS[l.level] }}
                  aria-hidden="true"
                />
                <span className="levelpicker__option-text">
                  <span className="levelpicker__option-name">{l.name}</span>
                  <span className="levelpicker__option-promise">{l.promise}</span>
                </span>
              </button>
            )
          })}
        </div>

        <button className="levelpicker__done" onClick={() => ref.current?.close()}>
          Gotowe
        </button>
      </div>
    </dialog>
  )
}
