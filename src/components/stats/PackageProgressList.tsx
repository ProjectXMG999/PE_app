import { useMemo } from 'react'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
import { PackageProgress } from '../../types/progress'
import { getStatus } from '../../utils/packVisuals'
import { useProgressData } from '../../hooks/useProgressData'
import './PackageProgressList.css'

const packs = packagesIndex as PackMeta[]
/** Built once for the module. The render loop used to `packs.find(...)` per row,
 *  which is a linear scan of 834 packs for every row drawn. */
const packById = new Map(packs.map(p => [p.id, p]))

interface Props {
  /** Cap the list. Without one, a committed learner renders hundreds of rows
   *  and the page grows to several screens of identical bars. */
  limit?: number
  /** Changes when the page wants fresh data. Passed through to useProgressData
   *  rather than used as a React `key` on this component: a changing key
   *  remounts, which threw away the sort memo and the DOM on every tick. */
  refreshKey?: unknown
}

/** Newest of the three things that can have happened to a pack, so a capped
 *  list really is the most recent five. Listening through counts as touching
 *  it — it lives on its own field now (see types/progress.ts). */
function lastTouched(pp: PackageProgress): string {
  return [pp.listenedAt, pp.completedAt, pp.startedAt]
    .filter((d): d is string => d != null)
    .reduce((newest, d) => (d > newest ? d : newest), pp.startedAt)
}

export function PackageProgressList({ limit, refreshKey }: Props = {}) {
  const snapshot = useProgressData(refreshKey)
  // Not `?? []` here: that allocates a fresh array on every render while the
  // snapshot is still loading, which would change the memo key below each time.
  const all = snapshot?.packageProgress

  // Most recently touched first, so a capped list shows what's actually current
  // rather than whatever the store happened to return first. Keyed on `all`
  // rather than `snapshot`: it's the same reference for the life of a snapshot,
  // and the sort has no business re-running on an unrelated re-render.
  const progress = useMemo(
    () =>
      all == null
        ? []
        : limit == null
          ? all
          : [...all]
              .sort((a, b) => lastTouched(b).localeCompare(lastTouched(a)))
              .slice(0, limit),
    [all, limit]
  )

  if (progress.length === 0) {
    return (
      <div className="packprogress__empty">
        Zacznij sesję, by zobaczyć postęp
      </div>
    )
  }

  return (
    <div className="packprogress">
      {progress.map(pp => {
        const pack = packById.get(pp.packageId)
        if (!pack) return null
        // The bar used to be `currentIndex / wordCount` — the Słuchaj playback
        // pointer — while the badge beside it came from `completedAt`. On the
        // Postęp page, next to a "★ Opanowana" badge, that mixed two axes in
        // one row; now it shows knowledge, which is what the badge ranks on.
        const known = snapshot?.knownMap.get(pp.packageId) ?? 0
        const pct = pack.wordCount > 0 ? Math.round((known / pack.wordCount) * 100) : 0
        const status = getStatus(pp)
        const isMastered = status === 'mastered'
        return (
          <div key={pp.packageId} className={`packprogress__item${isMastered ? ' packprogress__item--mastered' : ''}`}>
            <div className="packprogress__name-row">
              <span className="packprogress__name">{pack.name}</span>
              {isMastered && <span className="packprogress__badge packprogress__badge--mastered">★ Opanowana</span>}
              {status === 'listened' && <span className="packprogress__badge packprogress__badge--completed">✓ Odsłuchana</span>}
              {status === 'worked' && <span className="packprogress__badge packprogress__badge--completed">✓ Przerobiona</span>}
            </div>
            <div className="packprogress__bar-row">
              <div className="packprogress__bar">
                <div className={`packprogress__bar-fill${isMastered ? ' packprogress__bar-fill--mastered' : ''}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="packprogress__pct">{pct}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
