import { useEffect, useState } from 'react'
import { getAllPackageProgress } from '../../services/db'
import { PackageProgress } from '../../types/progress'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
import './PackageProgressList.css'

const packs = packagesIndex as PackMeta[]

export function PackageProgressList() {
  const [progress, setProgress] = useState<PackageProgress[]>([])

  useEffect(() => {
    getAllPackageProgress().then(setProgress)
  }, [])

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
        const pack = packs.find(p => p.id === pp.packageId)
        if (!pack) return null
        const pct = Math.round((pp.currentIndex / pack.wordCount) * 100)
        return (
          <div key={pp.packageId} className="packprogress__item">
            <div className="packprogress__name">{pack.name}</div>
            <div className="packprogress__bar-row">
              <div className="packprogress__bar">
                <div className="packprogress__bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="packprogress__pct">{pct}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
