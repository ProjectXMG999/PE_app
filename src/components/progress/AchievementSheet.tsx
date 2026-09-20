import { useEffect, useRef, useState } from 'react'
import { AchievementState } from '../../services/achievements'
import { ACHIEVEMENT_GROUPS, TIER_LABEL, unitLabel } from '../../data/achievements'
import { Confetti } from '../shared/Confetti'
import { playUnlock } from '../../services/sfx'
import { shareBadge } from '../../services/badgeCard'
import './tiers.css'
import './AchievementSheet.css'

interface Props {
  state: AchievementState
  onClose: () => void
  /** Route context for the share card — see services/badgeCard.ts. */
  knownTotal?: number
  nextStation?: { words: number; name: string } | null
}

/**
 * Badge detail. Uses the native <dialog> element, matching the other sheets in
 * the app — free focus trap and Escape handling rather than a hand-rolled one.
 */
export function AchievementSheet({ state, onClose, knownTotal = 0, nextStation = null }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const { achievement: a, unlocked, value, pct, unlockedAt, isNew } = state
  // Captured on open: the parent marks the badge seen the moment it opens, and
  // the celebration must not vanish on that re-render.
  const [celebrate] = useState(() => unlocked && isNew === true)
  const group = ACHIEVEMENT_GROUPS.find(g => g.id === a.group)
  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    setShareNote(null)
    const result = await shareBadge(state, knownTotal, nextStation)
    // "Downloaded" is the honest word where the share sheet doesn't exist —
    // saying "udostępniono" when a file landed in Pobrane would be a lie.
    if (result === 'downloaded') setShareNote('Zapisano obrazek')
    else if (result === 'failed') setShareNote('Nie udało się przygotować obrazka')
    setSharing(false)
  }

  useEffect(() => {
    ref.current?.showModal()
    if (celebrate) {
      playUnlock(a.tier)
      navigator.vibrate?.([8, 40, 12])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className={`achsheet__inner${unlocked ? ` tier-${a.tier}` : ''}`}>
        {celebrate && <Confetti bursts={[[46, 140], [28, 520]]} className="achsheet__confetti" />}
        <span className="achsheet__handle" aria-hidden="true" />

        <span className={`achsheet__medal${unlocked ? ' achsheet__medal--unlocked' : ''}`} aria-hidden="true">
          <span className={`achsheet__icon${unlocked ? ` achsheet__icon--${a.tier}` : ' achsheet__icon--locked'}`}>
            {a.icon}
          </span>
        </span>

        {celebrate && <p className="achsheet__new">Nowa odznaka</p>}

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
              {' '}{unitLabel(a.unit, a.threshold)}
              <span className="achsheet__remaining">
                jeszcze {(a.threshold - value).toLocaleString('pl-PL')}
              </span>
            </p>
          </div>
        )}

        {/* Only for badges actually earned — a card announcing something you
            haven't done yet is the opposite of the point. */}
        {unlocked && (
          <>
            <button className="achsheet__share" onClick={handleShare} disabled={sharing}>
              {sharing ? 'Przygotowuję…' : 'Pokaż znajomym'}
            </button>
            {shareNote && <p className="achsheet__share-note">{shareNote}</p>}
          </>
        )}

        <button className="achsheet__close" onClick={() => ref.current?.close()}>
          Zamknij
        </button>
      </div>
    </dialog>
  )
}
