import { useAppStore } from '../../store/useAppStore'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
import './FilterTabs.css'

const allPacks = packagesIndex as PackMeta[]

const STATUS_TABS = [
  { id: 'all',       label: 'Wszystkie' },
  { id: 'new',       label: 'Nowe' },
  { id: 'started',   label: 'W toku' },
  { id: 'completed', label: '✓ Odsłuchane' },
  { id: 'mastered',  label: '★ Opanowane' },
] as const

type StatusTabId = typeof STATUS_TABS[number]['id']

const LEVELS = [1, 2, 3, 4]

// Derive unique categories in order of first appearance
const CATEGORIES: string[] = Array.from(
  new Set(allPacks.map(p => p.category))
)

export function FilterTabs() {
  const { activeFilter, setFilter, activeLevel, setLevel, activeCategory, setCategory } = useAppStore()

  return (
    <div className="filtertabs">
      {/* Row 1: Status */}
      <div className="filtertabs__row filtertabs__row--scroll">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            className={`filtertabs__tab ${activeFilter === tab.id ? 'filtertabs__tab--active' : ''}`}
            onClick={() => setFilter(tab.id as StatusTabId)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Row 2: Level */}
      <div className="filtertabs__row filtertabs__row--scroll">
        {LEVELS.map(lvl => (
          <button
            key={lvl}
            className={`filtertabs__tab ${activeLevel === lvl ? 'filtertabs__tab--active' : ''}`}
            onClick={() => setLevel(activeLevel === lvl ? null : lvl)}
          >
            Poz. {lvl}
          </button>
        ))}
      </div>

      {/* Row 3: Category — horizontal scroll */}
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
    </div>
  )
}
