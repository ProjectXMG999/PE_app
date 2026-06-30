import { useAppStore } from '../../store/useAppStore'
import './FilterTabs.css'

const TABS = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'started', label: 'W toku' },
  { id: 'completed', label: 'Ukończone' },
] as const

type TabId = typeof TABS[number]['id']

export function FilterTabs() {
  const { activeFilter, setFilter } = useAppStore()

  return (
    <div className="filtertabs">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`filtertabs__tab ${activeFilter === tab.id ? 'filtertabs__tab--active' : ''}`}
          onClick={() => setFilter(tab.id as TabId)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
