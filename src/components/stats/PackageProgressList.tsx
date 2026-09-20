import { useMemo } from 'react'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
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
              .sort((a, b) =>
                (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt)
              )
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
        const pct = Math.round((pp.currentIndex / pack.wordCount) * 100)
        const isMastered = pp.masteredAt != null
        const isCompleted = pp.completedAt != null && !isMastered
        return (
          <div key={pp.packageId} className={`packprogress__item${isMastered ? ' packprogress__item--mastered' : ''}`}>
            <div className="packprogress__name-row">
              <span className="packprogress__name">{pack.name}</span>
              {isMastered && <span className="packprogress__badge packprogress__badge--mastered">★ Opanowana</span>}
              {isCompleted && <span className="packprogress__badge packprogress__badge--completed">✓ Odsłuchana</span>}
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
