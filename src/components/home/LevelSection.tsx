import { ReactNode } from 'react'
import { LEVEL_META } from '../../data/levels'
import { LEVEL_COLORS } from '../../utils/packVisuals'
import { LevelGroup, VolumeStats } from '../../utils/packRoute'
import './LevelSection.css'

interface Props {
  group: LevelGroup
  stats: VolumeStats
  children: ReactNode
}

/**
 * The top level of the route's structure: Level → Tom → pack.
 *
 * Volumes alone were a flat run of nine near-identical bands; the four levels
 * are what the product actually promises ("Dogadasz się w podróży",
 * "Powiesz, co myślisz"), so they are the chapters and volumes are the sections
 * inside them.
 *
 * Crucially this reorders nothing. Volumes are contiguous in curriculum order,
 * and each one is filed under its majority level (`volumeLevel`), so the route
 * still reads 1…865 straight down the page — see the note there for why
 * grouping the *packs* by level instead would tear it apart.
 */
export function LevelSection({ group, stats, children }: Props) {
  const meta = LEVEL_META.find(l => l.level === group.level)
  const pct = Math.round(stats.pct)

  return (
    <section
      className="lvlsec"
      style={{ ['--band' as string]: LEVEL_COLORS[group.level] ?? 'var(--text-muted)' }}
      aria-label={`Level ${group.level}${meta ? ` — ${meta.name}` : ''}`}
    >
      <header className="lvlsec__head">
        <p className="lvlsec__kicker">Level {group.level}</p>
        <h2 className="lvlsec__name">{meta?.name ?? `Poziom ${group.level}`}</h2>
        {meta && <p className="lvlsec__promise">{meta.promise}</p>}

        {/* Deliberately no pack range here: every volume band below carries its
            own #a–#b, and repeating the level's range directly above the only
            volume that spans it was pure duplication. The level owns identity
            and progress; the volume owns the address. */}
        <div className="lvlsec__meta">
          <span>{group.volumes.length === 1 ? '1 tom' : `${group.volumes.length} tomy`}</span>
          <span className="lvlsec__dot" aria-hidden="true" />
          <span>{stats.packs} pakietów</span>
          <span className="lvlsec__pct">{pct}%</span>
        </div>

        <div className="lvlsec__meter" aria-hidden="true">
          <span className="lvlsec__meter-fill" style={{ width: `${pct}%` }} />
        </div>
      </header>

      {children}
    </section>
  )
}
