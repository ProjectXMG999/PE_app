import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AchievementState } from '../../services/achievements'
import { ACHIEVEMENT_GROUPS, TIER_LABEL, unitLabel } from '../../data/achievements'
import { Confetti } from '../shared/Confetti'
import { Sheet, sheetRise, sheetRiseReduced, type SheetHandle } from '../shared/Sheet'
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
 * Badge detail. One `<Sheet>` like every other — the spring, the scrim and the
 * drag-to-dismiss are shared; what belongs to this sheet is the medallion, and
 * the order things arrive in: the medal lands first, then the name, then the
 * number. Tapping a badge should feel like picking it up.
 */
export function AchievementSheet({ state, onClose, knownTotal = 0, nextStation = null }: Props) {
  const sheet = useRef<SheetHandle>(null)
  const reduced = useReducedMotion()
  const rise = reduced ? sheetRiseReduced : sheetRise
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
    if (celebrate) {
      playUnlock(a.tier)
      navigator.vibrate?.([8, 40, 12])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Sheet
      ref={sheet}
      onClose={onClose}
      dialogClassName="achsheet"
      className={`achsheet__inner${unlocked ? ` tier-${a.tier}` : ''}`}
      aria-label={a.title}
    >
      {celebrate && <Confetti bursts={[[46, 140], [28, 520]]} className="achsheet__confetti" />}

      <motion.span
        className={`achsheet__medal${unlocked ? ' achsheet__medal--unlocked' : ''}`}
        variants={rise}
        aria-hidden="true"
      >
        <span className={`achsheet__icon${unlocked ? ` achsheet__icon--${a.tier}` : ' achsheet__icon--locked'}`}>
          {a.icon}
        </span>
      </motion.span>

      {celebrate && <motion.p className="achsheet__new" variants={rise}>Nowa odznaka</motion.p>}

      <motion.p className="achsheet__group" variants={rise}>
        {group?.label ?? ''} · {TIER_LABEL[a.tier] ?? a.tier}
      </motion.p>
      <motion.h2 className="achsheet__title" variants={rise}>{a.title}</motion.h2>
      <motion.p className="achsheet__desc" variants={rise}>{a.desc}</motion.p>

      {unlocked ? (
        <motion.p className="achsheet__status achsheet__status--done" variants={rise}>
          ✓ Zdobyte
          {unlockedAt && (
            <span className="achsheet__date">
              {new Date(unlockedAt).toLocaleDateString('pl-PL', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
          )}
        </motion.p>
      ) : (
        <motion.div className="achsheet__progress" variants={rise}>
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
        </motion.div>
      )}

      {/* Only for badges actually earned — a card announcing something you
          haven't done yet is the opposite of the point. */}
      {unlocked && (
        <>
          <motion.button
            type="button"
            className="achsheet__share u-cta"
            variants={rise}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            onClick={handleShare}
            disabled={sharing}
          >
            {sharing ? 'Przygotowuję…' : 'Pokaż znajomym'}
          </motion.button>
          {shareNote && <p className="achsheet__share-note">{shareNote}</p>}
        </>
      )}

      <motion.button
        type="button"
        className="achsheet__close"
        variants={rise}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        onClick={() => sheet.current?.close()}
      >
        Zamknij
      </motion.button>
    </Sheet>
  )
}
