import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { LEVEL_COLORS, LEVEL_META } from '../../data/levels'
import { LevelGroup, VolumeStats } from '../../utils/packRoute'
import { NavIndicator } from '../layout/NavIndicator'
import './RouteSwitcher.css'

interface Props {
  levels: LevelGroup[]
  levelStats: VolumeStats[]
  /** volume label → its stats. */
  volumeStats: Map<string, VolumeStats>
  /** The volume whose packs are on screen. */
  selected: string
  /** The volume holding your next pack — marked with a dot wherever it appears. */
  frontierVolume: string | null
  onSelect: (volume: string) => void
  /**
   * While a Stan/Kategoria filter is on: volume → matching packs. Each chip and
   * level then shows its count, and the ones with none are dimmed — so the
   * filter tells you *where* your packs are, not only which.
   */
  matches?: Map<string, number> | null
}

/** "Survival English" → "Survival": four segments have to fit a phone. */
function shortName(level: number): string {
  const name = LEVEL_META.find(l => l.level === level)?.name ?? `Poziom ${level}`
  return name.replace(/\s+English$/i, '')
}

/**
 * Where on the route you are looking: level, then volume.
 *
 * Replaces a single 864-row scroll with two taps. The route is still one
 * ordered road — levels and volumes are contiguous and nothing is re-sorted —
 * but you only ever scroll through the stretch you picked.
 *
 * Levels are a segmented control rather than chips because there are always
 * exactly four and they never scroll; volumes are chips because a level holds
 * one to four of them. Both use the same sliding indicator as Dzisiaj's mode
 * switch (`NavIndicator`), so the two screens share one motion vocabulary.
 */
export function RouteSwitcher({
  levels, levelStats, volumeStats, selected, frontierVolume, onSelect, matches = null,
}: Props) {
  const activeLevel = levels.find(l => l.volumes.some(v => v.volume === selected)) ?? levels[0]
  const volsRef = useRef<HTMLDivElement>(null)

  // Keep the selected chip in view when it changes from somewhere else (a
  // search hit, "Jesteś tu", the next-volume button).
  useEffect(() => {
    const row = volsRef.current
    const chip = row?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!row || !chip) return
    const target = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2
    row.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [selected])

  /**
   * Picking a level lands you where it makes sense to be in it: your own
   * position if it is in this level, otherwise the first volume you haven't
   * finished, otherwise its first volume.
   */
  const pickLevel = (group: LevelGroup) => {
    if (group.volumes.some(v => v.volume === selected)) return
    // With a filter on, land where the matches are.
    const matching = matches ? group.volumes.find(v => (matches.get(v.volume) ?? 0) > 0) : undefined
    const here = group.volumes.find(v => v.volume === frontierVolume)
    const open = group.volumes.find(v => {
      const s = volumeStats.get(v.volume)
      return s ? s.done < s.packs : true
    })
    onSelect((matching ?? here ?? open ?? group.volumes[0]).volume)
  }

  const levelMatches = (group: LevelGroup) =>
    group.volumes.reduce((sum, v) => sum + (matches?.get(v.volume) ?? 0), 0)

  return (
    <nav className="rsw" aria-label="Wybór poziomu i tomu">
      <div className="rsw__levels" role="tablist" aria-label="Poziom">
        {levels.map((group, i) => {
          const on = group.level === activeLevel.level
          const pct = Math.round(levelStats[i]?.pct ?? 0)
          const here = group.volumes.some(v => v.volume === frontierVolume)
          const n = matches ? levelMatches(group) : null
          return (
            <button
              key={group.level}
              type="button"
              role="tab"
              aria-selected={on}
              className={`rsw__level${on ? ' is-on' : ''}${n === 0 ? ' is-empty' : ''}`}
              style={{ '--lvl': LEVEL_COLORS[group.level] } as CSSProperties}
              onClick={() => pickLevel(group)}
            >
              {on && <NavIndicator layoutId="pakiety-level" className="rsw__level-ind" />}
              {n != null && n > 0 && <span className="rsw__count rsw__count--level">{n}</span>}
              <span className="rsw__level-name">
                {shortName(group.level)}
                {here && <span className="rsw__here" aria-label="tu jesteś" />}
              </span>
              <span className="rsw__level-bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
            </button>
          )
        })}
      </div>

      <div className="rsw__vols" role="tablist" aria-label="Tom" ref={volsRef}>
        {activeLevel.volumes.map(v => {
          const on = v.volume === selected
          const s = volumeStats.get(v.volume)
          const pct = Math.round(s?.pct ?? 0)
          const n = matches ? (matches.get(v.volume) ?? 0) : null
          return (
            <button
              key={v.volume}
              type="button"
              role="tab"
              aria-selected={on}
              className={`rsw__vol${on ? ' is-on' : ''}${n === 0 ? ' is-empty' : ''}`}
              style={{ '--pct': pct, '--lvl': LEVEL_COLORS[activeLevel.level] } as CSSProperties}
              onClick={() => onSelect(v.volume)}
            >
              {on && <NavIndicator layoutId="pakiety-volume" className="rsw__vol-ind" />}
              <span className="rsw__vol-ring" aria-hidden="true" />
              <span className="rsw__vol-name">Tom {v.short}</span>
              {n == null
                ? <span className="rsw__vol-range">{v.firstNum}–{v.lastNum}</span>
                : <span className={`rsw__count${n === 0 ? ' is-zero' : ''}`}>{n}</span>}
              {v.volume === frontierVolume && <span className="rsw__here" aria-label="tu jesteś" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
