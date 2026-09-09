import { useEffect, useRef } from 'react'
import { LEVEL_META } from '../../data/levels'
import { LEVEL_COLORS } from '../../utils/packVisuals'
import { PackFilters, PackStatusFilter } from '../../utils/packRoute'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
import { LevelProgressBars } from './LevelProgressBars'
import './PackFilterSheet.css'

const allPacks = packagesIndex as PackMeta[]

const STATUS_OPTIONS: { id: PackStatusFilter; label: string }[] = [
  { id: 'all',       label: 'Wszystkie' },
  { id: 'new',       label: 'Nowe' },
  { id: 'started',   label: 'W toku' },
  { id: 'completed', label: '✓ Odsłuchane' },
  { id: 'mastered',  label: '★ Opanowane' },
]

interface Props {
  kind: 'level' | 'category' | 'status'
  filters: PackFilters
  onChange: (patch: Partial<PackFilters>) => void
  categories: { cat: string; n: number }[]
  levelCounts: Record<number, number>
  statusCounts: Record<string, number>
  knownMap: Map<string, number>
  onClose: () => void
}

export function PackFilterSheet({
  kind, filters, onChange, categories, levelCounts, statusCounts, knownMap, onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])

  const close = () => ref.current?.close()
  const pick = (patch: Partial<PackFilters>) => { onChange(patch); close() }

  const title = kind === 'level' ? 'Poziom' : kind === 'category' ? 'Kategoria' : 'Status'

  return (
    <dialog
      ref={ref}
      className="pfsheet"
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) close() }}
    >
      <div className="pfsheet__inner">
        <span className="pfsheet__handle" aria-hidden="true" />
        <h2 className="pfsheet__title">{title}</h2>

        {kind === 'level' && (
          <>
            <div className="pfsheet__progress">
              <LevelProgressBars allPacks={allPacks} knownMap={knownMap} />
            </div>
            <div className="pfsheet__list" role="radiogroup" aria-label="Poziom">
              <button
                className={`pfsheet__row${filters.level == null ? ' is-active' : ''}`}
                role="radio" aria-checked={filters.level == null}
                onClick={() => pick({ level: null })}
              >
                <span className="pfsheet__row-name">Wszystkie poziomy</span>
              </button>
              {LEVEL_META.map(l => (
                <button
                  key={l.level}
                  className={`pfsheet__row${filters.level === l.level ? ' is-active' : ''}`}
                  role="radio" aria-checked={filters.level === l.level}
                  onClick={() => pick({ level: l.level })}
                >
                  <span className="pfsheet__dot" style={{ background: LEVEL_COLORS[l.level] }} aria-hidden="true" />
                  <span className="pfsheet__row-text">
                    <span className="pfsheet__row-name">Level {l.level} · {l.name}</span>
                    <span className="pfsheet__row-sub">{l.promise}</span>
                  </span>
                  <span className="pfsheet__count">{levelCounts[l.level] ?? 0}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {kind === 'category' && (
          <div className="pfsheet__grid">
            <button
              className={`pfsheet__chip${filters.cat == null ? ' is-active' : ''}`}
              onClick={() => pick({ cat: null })}
            >
              Wszystkie
            </button>
            {categories.map(({ cat, n }) => (
              <button
                key={cat}
                className={`pfsheet__chip${filters.cat === cat ? ' is-active' : ''}`}
                onClick={() => pick({ cat })}
              >
                {cat} <span className="pfsheet__chip-n">{n}</span>
              </button>
            ))}
          </div>
        )}

        {kind === 'status' && (
          <div className="pfsheet__list" role="radiogroup" aria-label="Status">
            {STATUS_OPTIONS.map(o => (
              <button
                key={o.id}
                className={`pfsheet__row${filters.status === o.id ? ' is-active' : ''}`}
                role="radio" aria-checked={filters.status === o.id}
                onClick={() => pick({ status: o.id })}
              >
                <span className="pfsheet__row-name">{o.label}</span>
                <span className="pfsheet__count">{statusCounts[o.id] ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        <button className="pfsheet__close" onClick={close}>Gotowe</button>
      </div>
    </dialog>
  )
}
