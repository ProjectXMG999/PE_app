import { useEffect, useMemo, useRef, useState } from 'react'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
import { ProgressSnapshot } from '../../hooks/useProgressData'
import {
  PackFilters,
  PackStatusFilter,
  filtersActive,
  packMatchesStatus,
} from '../../utils/packRoute'
import { PackFilterSheet } from './PackFilterSheet'
import './PackFilterBar.css'

const allPacks = packagesIndex as PackMeta[]

const CATEGORY_ORDER = [
  'Czasowniki', 'Przymiotniki', 'Rzeczowniki', 'Liczby', 'Maleństwa', 'Zaimki',
  'Phrasale', 'Przysłówki', 'Spójniki', 'Slang', 'Piękne', 'Skróty', 'Wulgaryzmy',
]

const STATUS_LABEL: Record<PackStatusFilter, string> = {
  all: 'Status', new: 'Nowe', started: 'W toku', completed: 'Odsłuchane', mastered: 'Opanowane',
}

interface Props {
  filters: PackFilters
  onChange: (patch: Partial<PackFilters>) => void
  onClear: () => void
  resultCount: number
  total: number
  snapshot: ProgressSnapshot | null
  /** Volume currently under the bar, from HomePage's scroll-spy (map mode only). */
  currentVolume?: string | null
}

export function PackFilterBar({
  filters, onChange, onClear, resultCount, total, snapshot, currentVolume,
}: Props) {
  const [sheet, setSheet] = useState<null | 'level' | 'category' | 'status'>(null)
  const [searchOpen, setSearchOpen] = useState(filters.query !== '')
  const barRef = useRef<HTMLDivElement>(null)

  // The bar is sticky and the volume headers stick *below* it, so they need its
  // live height — it changes when the search field opens.
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const page = el.closest('.homepage') as HTMLElement | null
    if (!page) return
    const publish = () => {
      page.style.setProperty('--pfbar-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of allPacks) counts.set(p.category, (counts.get(p.category) ?? 0) + 1)
    const known = CATEGORY_ORDER.filter(c => counts.has(c))
    const rest = [...counts.keys()].filter(c => !CATEGORY_ORDER.includes(c)).sort()
    return [...known, ...rest].map(cat => ({ cat, n: counts.get(cat) ?? 0 }))
  }, [])

  const levelCounts = useMemo(() => {
    const c: Record<number, number> = {}
    for (const p of allPacks) c[p.level] = (c[p.level] ?? 0) + 1
    return c
  }, [])

  const statusCounts = useMemo(() => {
    const ids: PackStatusFilter[] = ['all', 'new', 'started', 'completed', 'mastered']
    const c: Record<string, number> = {}
    for (const id of ids) c[id] = allPacks.filter(p => packMatchesStatus(p, snapshot, id)).length
    return c
  }, [snapshot])

  const active = filtersActive(filters)
  const levelName = filters.level != null
    ? `Level ${filters.level}`
    : 'Poziom'

  return (
    <div className="pfbar" ref={barRef}>
      <div className="pfbar__row">
        {searchOpen ? (
          <div className="pfbar__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              autoFocus
              type="search"
              placeholder="Szukaj pakietu…"
              value={filters.query}
              onChange={e => onChange({ query: e.target.value })}
              onKeyDown={e => { if (e.key === 'Escape') { onChange({ query: '' }); setSearchOpen(false) } }}
              aria-label="Szukaj pakietu"
            />
            <button
              className="pfbar__search-close"
              onClick={() => { onChange({ query: '' }); setSearchOpen(false) }}
              aria-label="Zamknij wyszukiwanie"
            >×</button>
          </div>
        ) : (
          <>
            <button className="pfbar__btn pfbar__btn--icon" onClick={() => setSearchOpen(true)} aria-label="Szukaj">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
            </button>
            <button
              className={`pfbar__btn${filters.level != null ? ' is-active' : ''}`}
              onClick={() => setSheet('level')}
            >
              {levelName} <span className="pfbar__caret" aria-hidden="true">▾</span>
            </button>
            <button
              className={`pfbar__btn${filters.cat != null ? ' is-active' : ''}`}
              onClick={() => setSheet('category')}
            >
              {filters.cat ?? 'Kategoria'} <span className="pfbar__caret" aria-hidden="true">▾</span>
            </button>
            <button
              className={`pfbar__btn${filters.status !== 'all' ? ' is-active' : ''}`}
              onClick={() => setSheet('status')}
            >
              {STATUS_LABEL[filters.status]} <span className="pfbar__caret" aria-hidden="true">▾</span>
            </button>
          </>
        )}
      </div>

      <div className="pfbar__meta">
        <span className="pfbar__count">
          {active ? `${resultCount.toLocaleString('pl-PL')} z ${total.toLocaleString('pl-PL')} pakietów` : `${total.toLocaleString('pl-PL')} pakietów`}
        </span>
        {!active && currentVolume && (
          <span className="pfbar__here" aria-live="polite">{currentVolume}</span>
        )}
        {active && (
          <button className="pfbar__clear" onClick={() => { onClear(); setSearchOpen(false) }}>
            Wyczyść filtry
          </button>
        )}
      </div>

      {sheet && (
        <PackFilterSheet
          kind={sheet}
          filters={filters}
          onChange={onChange}
          categories={categories}
          levelCounts={levelCounts}
          statusCounts={statusCounts}
          knownMap={snapshot?.knownMap ?? new Map()}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
