import { useEffect, useRef } from 'react'
import { AchievementState } from '../../services/achievements'
import { ACHIEVEMENT_GROUPS } from '../../data/achievements'
import './AchievementSheet.css'

interface Props {
  state: AchievementState
  onClose: () => void
}

const TIER_LABEL: Record<string, string> = {
  bronze: 'Brąz',
  silver: 'Srebro',
  gold: 'Złoto',
  legend: 'Legenda',
}

/**
 * Badge detail. Uses the native <dialog> element, matching the other sheets in
 * the app — free focus trap and Escape handling rather than a hand-rolled one.
 */
export function AchievementSheet({ state, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const { achievement: a, unlocked, value, pct, unlockedAt } = state
  const group = ACHIEVEMENT_GROUPS.find(g => g.id === a.group)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="achsheet"
      onClose={onClose}
      onClick={e => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="achsheet__inner">
        <span className="achsheet__handle" aria-hidden="true" />

        <span
          className={`achsheet__icon${unlocked ? ` achsheet__icon--${a.tier}` : ' achsheet__icon--locked'}`}
          aria-hidden="true"
        >
          {a.icon}
        </span>

        <p className="achsheet__group">
          {group?.label ?? ''} · {TIER_LABEL[a.tier] ?? a.tier}
        </p>
        <h2 className="achsheet__title">{a.title}</h2>
        <p className="achsheet__desc">{a.desc}</p>

        {unlocked ? (
          <p className="achsheet__status achsheet__status--done">
            ✓ Zdobyte
            {unlockedAt && (
              <span className="achsheet__date">
                {new Date(unlockedAt).toLocaleDateString('pl-PL', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </span>
            )}
          </p>
        ) : (
          <div className="achsheet__progress">
            <div className="achsheet__bar">
              <div className="achsheet__bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="achsheet__status">
              {value.toLocaleString('pl-PL')} / {a.threshold.toLocaleString('pl-PL')}
              {a.unit ? ` ${a.unit}` : ''}
              <span className="achsheet__remaining">
                jeszcze {(a.threshold - value).toLocaleString('pl-PL')}
              </span>
            </p>
          </div>
        )}

        <button className="achsheet__close" onClick={() => ref.current?.close()}>
          Zamknij
        </button>
      </div>
    </dialog>
  )
}
