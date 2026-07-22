import { ReactNode, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
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

const LEVELS = [
  {
    level: 1,
    name: 'Survival English',
    description: 'Znasz około 1000 najważniejszych słów. To jeszcze nie jest pełna swoboda, ale to już jest moment, w którym przestajesz być bezbronny. Zamówisz jedzenie, zapytasz o drogę, ogarniesz hotel, lotnisko, podstawową rozmowę i powiesz, czego potrzebujesz. To jest Twój językowy ekwipunek przetrwania.',
  },
  {
    level: 2,
    name: 'Everyday English',
    description: 'Znasz około 3000 słów. To jest moment, w którym zaczynasz naprawdę funkcjonować po angielsku. Porozmawiasz o pracy, podróżach, planach, rodzinie, problemach, emocjach i codziennych sprawach. Jeszcze czasem szukasz słów, ale już nie jesteś turystą językowym. Jesteś człowiekiem, który potrafi się dogadać.',
  },
  {
    level: 3,
    name: 'Freedom English',
    description: 'Znasz około 6000 słów. To jest poziom wolności. Nie musisz już ciągle upraszczać siebie. Możesz wyrazić opinię, opowiedzieć historię, zażartować, doprecyzować myśl, wytłumaczyć problem i być bardziej sobą po angielsku. Tu angielski przestaje być przeszkodą, a zaczyna być narzędziem.',
  },
  {
    level: 4,
    name: 'World-Class English',
    description: 'Znasz około 10 000 słów. To jest poziom, na którym nie tylko się komunikujesz. Ty brzmisz dobrze. Mówisz precyzyjnie, lekko, ciekawie i z klasą. Możesz prowadzić głębsze rozmowy, budować relacje, robić biznes, występować, pisać, uczyć się z anglojęzycznego świata i naprawdę czuć się obywatelem świata. To jest angielski, przy którym ludzie pytają: „gdzie Ty się tak nauczyłeś mówić?"',
  },
]

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

  const selectedLevelData = activeLevel ? LEVELS.find(l => l.level === activeLevel) : null

  return (
    <div className="filtertabs">
      {/* Row 1: Level */}
      <div className="filtertabs__row filtertabs__row--scroll">
        {LEVELS.map(lvlData => (
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
