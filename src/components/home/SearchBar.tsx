import { useAppStore } from '../../store/useAppStore'
import './SearchBar.css'

export function SearchBar() {
  const { searchQuery, setSearch } = useAppStore()

  return (
    <div className="searchbar">
      <svg className="searchbar__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="search"
        className="searchbar__input"
        placeholder="Szukaj paczki..."
        value={searchQuery}
        onChange={e => setSearch(e.target.value)}
      />
      {searchQuery && (
        <button className="searchbar__clear" onClick={() => setSearch('')} aria-label="Wyczyść">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  )
}
