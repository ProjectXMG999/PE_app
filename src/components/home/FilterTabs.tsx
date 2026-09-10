import { ReactNode, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
import { LEVEL_META } from '../../data/levels'
import { EASE_SPRING } from '../today/motion'
import './FilterTabs.css'

const allPacks = packagesIndex as PackMeta[]

const STATUS_TABS = [
  { id: 'new',       label: 'Nowe' },
  { id: 'mastered',  label: '★ Opanowane' },
  { id: 'completed', label: '✓ Odsłuchane' },
  { id: 'started',   label: 'W toku' },
  { id: 'all',       label: 'Wszystkie' },
] as const

type StatusTabId = typeof STATUS_TABS[number]['id']

// Per-level fill + glow for the sliding indicator — mirrors the hardcoded
// active colours in FilterTabs.css.
const LEVEL_FILL: Record<number, string> = { 1: '#eab308', 2: '#f97316', 3: '#22c55e', 4: '#3b82f6' }
const LEVEL_GLOW: Record<number, string> = {
  1: 'rgba(234,179,8,0.45)', 2: 'rgba(249,115,22,0.45)', 3: 'rgba(34,197,94,0.45)', 4: 'rgba(59,130,246,0.45)',
}

// Fixed category order
const CATEGORY_ORDER = [
  'Czasowniki',
  'Przymiotniki',
  'Rzeczowniki',
  'Liczby',
  'Maleństwa',
  'Zaimki',
  'Phrasale',
  'Przysłówki',
  'Spójniki',
  'Slang',
  'Piękne',
  'Skróty',
  'Wulgaryzmy',
]

// Derive unique categories in specified order
const allCategories = Array.from(new Set(allPacks.map(p => p.category)))
const CATEGORIES: string[] = CATEGORY_ORDER.filter(cat => allCategories.includes(cat)).concat(
  allCategories.filter(cat => !CATEGORY_ORDER.includes(cat))
)

interface FilterTabsProps {
  /** Rendered directly under the Level row (e.g. per-level progress bars). */
  afterLevelRow?: ReactNode
}

export function FilterTabs({ afterLevelRow }: FilterTabsProps) {
  const { activeFilter, setFilter, activeLevel, setLevel, activeCategory, setCategory } = useAppStore()
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null)
  const reduced = useReducedMotion()

  const catActiveRef = useRef<HTMLButtonElement>(null)
  const statusActiveRef = useRef<HTMLButtonElement>(null)

  // Keep the active pill of each horizontal-scroll row in view.
  useEffect(() => {
    catActiveRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [activeCategory, reduced])
  useEffect(() => {
    statusActiveRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [activeFilter, reduced])

  const selectedLevelData = activeLevel ? LEVEL_META.find(l => l.level === activeLevel) : null

  return (
    <div className="filtertabs">
      {/* Row 1: Level — evenly stretched across the full row, unlike the
          scrollable category/status rows, since there are always exactly 4. */}
      <div className="filtertabs__row filtertabs__row--level">
        {LEVEL_META.map(lvlData => {
          const active = activeLevel === lvlData.level
          return (
            <button
              key={lvlData.level}
              className={`filtertabs__tab filtertabs__tab--level${lvlData.level} ${active ? 'filtertabs__tab--active' : ''}`}
              onClick={() => {
                if (active) {
                  setLevel(null)
                  setExpandedLevel(null)
                } else {
                  setLevel(lvlData.level)
                  setExpandedLevel(lvlData.level)
                }
              }}
            >
              {active && (
                <motion.span
                  className="filtertabs__level-ind"
                  layoutId="filter-level-indicator"
                  transition={reduced ? { duration: 0 } : EASE_SPRING}
                  style={{
                    background: LEVEL_FILL[lvlData.level],
                    boxShadow: `0 0 12px ${LEVEL_GLOW[lvlData.level]}`,
                  }}
                />
              )}
              <span className="filtertabs__tab-label">Level {lvlData.level}</span>
            </button>
          )
        })}
      </div>

      {afterLevelRow}

      {/* Level description */}
      {selectedLevelData && (
        <div className="filtertabs__level-description" data-level={selectedLevelData.level}>
          <div className="filtertabs__level-description__header">
            <h3 className="filtertabs__level-description__name">{selectedLevelData.name}</h3>
          </div>
          <p className="filtertabs__level-description__text">{selectedLevelData.description}</p>
        </div>
      )}

      {/* Row 2: Category — horizontal scroll */}
      <div className="filtertabs__row filtertabs__row--scroll">
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat
          return (
            <button
              key={cat}
              ref={active ? catActiveRef : undefined}
              className={`filtertabs__tab ${active ? 'filtertabs__tab--active' : ''}`}
              onClick={() => setCategory(active ? null : cat)}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Row 3: Status */}
      <div className="filtertabs__row filtertabs__row--scroll">
        {STATUS_TABS.map(tab => {
          const active = activeFilter === tab.id
          return (
            <button
              key={tab.id}
              ref={active ? statusActiveRef : undefined}
              className={`filtertabs__tab ${active ? 'filtertabs__tab--active' : ''}`}
              onClick={() => setFilter(active ? null : (tab.id as StatusTabId))}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
