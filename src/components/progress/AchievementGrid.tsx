import { useMemo, useState } from 'react'
import { AchievementState, closestToUnlock, recentlyUnlocked } from '../../services/achievements'
import { ACHIEVEMENT_GROUPS } from '../../data/achievements'
import { AchievementTile } from './AchievementTile'
import { AchievementSheet } from './AchievementSheet'
import './AchievementGrid.css'

interface Props {
  states: AchievementState[]
  /** Called with the ids whose "new" celebration has been shown. */
  onSeen?: (ids: string[]) => void
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'dziś'
  if (days === 1) return 'wczoraj'
  if (days < 7) return `${days} dni temu`
  if (days < 30) return `${Math.floor(days / 7)} tyg. temu`
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The badge cabinet, in the order that actually motivates:
 * recently earned → closest to earning → everything else.
 *
 * The middle band is the point of the whole section. "79 / 100" is a far
 * stronger pull than a wall of trophies, because it names something achievable
 * in the next session.
 */
export function AchievementGrid({ states, onSeen }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<AchievementState | null>(null)

  const recent = useMemo(() => recentlyUnlocked(states, 4), [states])
  const close = useMemo(() => closestToUnlock(states, 3), [states])
  const unlockedCount = states.filter(s => s.unlocked).length

  function open(s: AchievementState) {
    setSelected(s)
    if (s.isNew) onSeen?.([s.achievement.id])
  }

  const grouped = useMemo(() => {
    return ACHIEVEMENT_GROUPS
      .map(g => ({ group: g, items: states.filter(s => s.achievement.group === g.id) }))
      .filter(g => g.items.length > 0)
  }, [states])

  return (
    <div className="achgrid">
      <header className="achgrid__header">
        <h2 className="achgrid__title">Odznaki</h2>
        <span className="achgrid__count">
          {unlockedCount} / {states.length}
        </span>
      </header>

      {recent.length > 0 && (
        <section className="achgrid__band">
          <h3 className="achgrid__band-title">Ostatnio zdobyte</h3>
          <div className="achgrid__strip">
            {recent.map(s => (
              <div key={s.achievement.id} className="achgrid__strip-item">
                <AchievementTile state={s} onClick={open} />
                {s.unlockedAt && (
                  <span className="achgrid__when">{timeAgo(s.unlockedAt)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {close.length > 0 && (
        <section className="achgrid__band">
          <h3 className="achgrid__band-title">Najbliżej zdobycia</h3>
          <div className="achgrid__near">
            {close.map(s => (
              <AchievementTile key={s.achievement.id} state={s} onClick={open} showProgress />
            ))}
          </div>
        </section>
      )}

      {expanded ? (
        <>
          {grouped.map(({ group, items }) => (
            <section key={group.id} className="achgrid__band">
              <h3 className="achgrid__band-title">
                <span aria-hidden="true">{group.icon}</span> {group.label}
                <span className="achgrid__band-count">
                  {items.filter(i => i.unlocked).length}/{items.length}
                </span>
              </h3>
              <div className="achgrid__all">
                {items.map(s => (
                  <AchievementTile key={s.achievement.id} state={s} onClick={open} />
                ))}
              </div>
            </section>
          ))}
          <button className="achgrid__toggle" onClick={() => setExpanded(false)}>
            Zwiń
          </button>
        </>
      ) : (
        <button className="achgrid__toggle" onClick={() => setExpanded(true)}>
          Zobacz wszystkie ({unlockedCount}/{states.length})
        </button>
      )}

      {selected && (
        <AchievementSheet state={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
