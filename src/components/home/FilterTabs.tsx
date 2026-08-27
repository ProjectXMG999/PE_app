import { ReactNode, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
import { LEVEL_META } from '../../data/levels'
import './FilterTabs.css'

const allPacks = packagesIndex as PackMeta[]

const STATUS_TABS = [
  { id: 'mastered',  label: '★ Opanowane' },
  { id: 'completed', label: '✓ Odsłuchane' },
  { id: 'started',   label: 'W toku' },
  { id: 'new',       label: 'Nowe' },
  { id: 'all',       label: 'Wszystkie' },
] as const

type StatusTabId = typeof STATUS_TABS[number]['id']

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

  const selectedLevelData = activeLevel ? LEVEL_META.find(l => l.level === activeLevel) : null

  return (
    <div className="filtertabs">
      {/* Row 1: Level — evenly stretched across the full row, unlike the
          scrollable category/status rows, since there are always exactly 4. */}
      <div className="filtertabs__row filtertabs__row--level">
        {LEVEL_META.map(lvlData => (
          <button
            key={lvlData.level}
            className={`filtertabs__tab filtertabs__tab--level${lvlData.level} ${activeLevel === lvlData.level ? 'filtertabs__tab--active' : ''}`}
            onClick={() => {
              if (activeLevel === lvlData.level) {
                setLevel(null)
                setExpandedLevel(null)
              } else {
                setLevel(lvlData.level)
                setExpandedLevel(lvlData.level)
              }
            }}
          >
            Level {lvlData.level}
          </button>
        ))}
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
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`filtertabs__tab ${activeCategory === cat ? 'filtertabs__tab--active' : ''}`}
            onClick={() => setCategory(activeCategory === cat ? null : cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Row 3: Status */}
      <div className="filtertabs__row filtertabs__row--scroll">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            className={`filtertabs__tab ${activeFilter === tab.id ? 'filtertabs__tab--active' : ''}`}
            onClick={() => setFilter(activeFilter === tab.id ? null : (tab.id as StatusTabId))}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
