import { useEffect, useMemo, useRef, useState } from 'react'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
import {
  LENS_LABEL,
  PackFilters,
  PackLens,
  isJumpQuery,
  isSearching,
  routeNumber,
} from '../../utils/packRoute'
import { CategoryStat } from '../../utils/packProfile'
import { PackFilterSheet, SheetKind } from './PackFilterSheet'
import './RouteControls.css'

const allPacks = packagesIndex as PackMeta[]

const CATEGORY_ORDER = [
  'Czasowniki', 'Przymiotniki', 'Rzeczowniki', 'Liczby', 'Maleństwa', 'Zaimki',
  'Phrasale', 'Przysłówki', 'Spójniki', 'Slang', 'Piękne', 'Skróty', 'Wulgaryzmy',
]

interface Props {
  filters: PackFilters
  onChange: (patch: Partial<PackFilters>) => void
  onClear: () => void
  /** All three scoped to the *other* active facets — see `facetCounts`. */
  lensCounts: Record<PackLens, number>
  categoryCounts: Record<string, number>
  resultCount: number
  stats: CategoryStat[]
  knownWords: number
  /** Jump straight to a pack — used by the `#317` shortcut. */
  onJump: (packId: string) => void
}

/**
 * One row: search, and a button for everything else.
 *
 * This screen exists to show packs, so chrome above them has to earn its height
 * on every single visit. Search does. A lens row, a volume index and a result
 * counter do not — they are occasional, and as permanent strips they added up
 * to roughly 230px before the first card. That is what a sheet is for.
 *
 * The two fast ways in stay instant:
 *  - **type a name** — fuzzy, for when you remember the pack;
 *  - **type a number** — exact, for when you remember the position, which is
 *    what the route numbers are *for*.
 */
export function RouteControls({
  filters, onChange, onClear, lensCounts, categoryCounts, resultCount, stats, knownWords, onJump,
}: Props) {
  const [sheet, setSheet] = useState<SheetKind | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // The bar is sticky and the volume headers stick *below* it, so they need its
  // live height — which changes when the jump hint or the result line appears.
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const page = el.closest('.homepage') as HTMLElement | null
    if (!page) return
    const publish = () => {
      page.style.setProperty('--rc-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fixed display order; the count for each comes from the caller (scoped to
  // whatever else is active — see facetCounts). A category absent from the
  // current scope still gets listed, at 0, so switching Level doesn't yank
  // rows out from under a sheet you already have open.
  const categories = useMemo(() => {
    const known = CATEGORY_ORDER.filter(c => categoryCounts[c] != null || allPacks.some(p => p.category === c))
    const rest = [...new Set(allPacks.map(p => p.category))].filter(c => !CATEGORY_ORDER.includes(c)).sort()
    return [...known, ...rest].map(cat => ({ cat, n: categoryCounts[cat] ?? 0 }))
  }, [categoryCounts])

  // A numeric query resolves to a real pack or to nothing — the route has gaps
  // (#102 doesn't exist), so this must be a lookup, never arithmetic on an index.
  const jumpTarget = useMemo(() => {
    if (!isJumpQuery(filters.query)) return null
    const n = parseInt(filters.query.trim().replace(/^#/, ''), 10)
    return allPacks.find(p => routeNumber(p.id) === n) ?? null
  }, [filters.query])

  const searching = isSearching(filters)
  const activeCount = (filters.lens !== 'all' ? 1 : 0) + (filters.cat != null ? 1 : 0)
  const filtering = activeCount > 0

  function doJump() {
    if (!jumpTarget) return
    onJump(jumpTarget.id)
    onChange({ query: '' })
  }

  return (
    <div className="rc" ref={barRef}>
      <div className="rc__row">
        <div className="rc__search">
          <svg className="rc__search-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            className="rc__search-input"
            placeholder="Nazwa albo numer"
            value={filters.query}
            onChange={e => onChange({ query: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter' && jumpTarget) { e.preventDefault(); doJump() }
              if (e.key === 'Escape') onChange({ query: '' })
            }}
            aria-label="Szukaj pakietu po nazwie lub numerze trasy"
          />
          {filters.query && (
            <button className="rc__search-clear" onClick={() => onChange({ query: '' })} aria-label="Wyczyść szukanie">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* A labelled button, not a bare icon. The filters are the only way to
            see the route through your memory (what's slipping, what's close to
            "Na stałe") and by category — an unlabelled 48px circle in the
            card colour read as decoration next to the search pill.
            Its width is fixed so the count badge appearing never shifts the
            search field under your thumb. */}
        <button
          className={`rc__filters${filtering ? ' is-active' : ''}`}
          onClick={() => setSheet('lens')}
          aria-label={filtering ? `Filtry, aktywne: ${activeCount}` : 'Filtry: stan i kategoria'}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="4" y1="7" x2="20" y2="7" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="17" x2="14" y2="17" />
          </svg>
          <span className="rc__filters-label">Filtry</span>
          {filtering && <span className="rc__filters-count" aria-hidden="true">{activeCount}</span>}
        </button>
      </div>

      {jumpTarget && (
        <button className="rc__jump" onClick={doJump}>
          <span className="rc__jump-num">
            <span className="rc__jump-nr">nr</span>{routeNumber(jumpTarget.id)}
          </span>
          <span className="rc__jump-name">{jumpTarget.name}</span>
          <span className="rc__jump-go" aria-hidden="true">Skocz →</span>
        </button>
      )}

      {/* What is narrowing the route, each removable on its own. Without this
          row a filtered volume looks like a volume with fewer packs in it. */}
      {filtering && (
        <div className="rc__chips" aria-label="Aktywne filtry">
          {filters.lens !== 'all' && (
            <button className="rc__chip" onClick={() => onChange({ lens: 'all' })} aria-label={`Usuń filtr: ${LENS_LABEL[filters.lens]}`}>
              <span className={`rc__chip-dot pfsheet__lens-dot pfsheet__lens-dot--${filters.lens}`} aria-hidden="true" />
              {LENS_LABEL[filters.lens]}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {filters.cat != null && (
            <button className="rc__chip" onClick={() => onChange({ cat: null })} aria-label={`Usuń filtr: ${filters.cat}`}>
              {filters.cat}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {activeCount > 1 && (
            <button className="rc__chip rc__chip--clear" onClick={() => onChange({ lens: 'all', cat: null })}>
              Wyczyść
            </button>
          )}
        </div>
      )}

      {/* Search is the one mode that leaves the route for a flat list, so it is
          the one that needs a way back. */}
      {searching && !jumpTarget && (
        <div className="rc__result">
          <span>{resultCount.toLocaleString('pl-PL')} z {allPacks.length.toLocaleString('pl-PL')}</span>
          <button className="rc__clear" onClick={onClear}>Wróć na trasę</button>
        </div>
      )}

      {sheet && (
        <PackFilterSheet
          kind={sheet}
          filters={filters}
          onChange={onChange}
          onSwitchKind={setSheet}
          lensCounts={lensCounts}
          knownWords={knownWords}
          categories={categories}
          categoryStats={stats}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
