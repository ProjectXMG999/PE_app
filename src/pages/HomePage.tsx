import { useEffect, useRef } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { InstallBanner } from '../components/home/InstallBanner'
import { QuickStartCards } from '../components/home/QuickStartCards'
import { StatsRow } from '../components/home/StatsRow'
import { SearchBar } from '../components/home/SearchBar'
import { FilterTabs } from '../components/home/FilterTabs'
import { SectionHeader } from '../components/home/SectionHeader'
import { PackageCard } from '../components/home/PackageCard'
import { OnboardingCard } from '../components/home/OnboardingCard'
import { OnboardingModal } from '../components/onboarding/OnboardingModal'
import { useAppStore } from '../store/useAppStore'
import { useProgressData } from '../hooks/useProgressData'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './HomePage.css'

const allPacks = packagesIndex as PackMeta[]
const SCROLL_KEY = 'pe-home-scroll'

export function HomePage() {
  const { searchQuery, setSearch, activeFilter, setFilter, activeLevel, setLevel, activeCategory, setCategory } = useAppStore()
  const snapshot = useProgressData()
  const listRef = useRef<HTMLDivElement>(null)

  // Restore scroll position lost when the route (and this component) unmounts
  // while navigating into a pack, so returning to Home doesn't dump the user
  // back at the top of a 232-card list.
  useEffect(() => {
    const main = document.querySelector('.appshell__main')
    if (!main) return
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved) main.scrollTop = parseInt(saved, 10)
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, String(main.scrollTop))
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  const progressMap = snapshot?.progressMap ?? new Map()
  const knownMap = snapshot?.knownMap ?? new Map()

  const filtered = allPacks.filter(pack => {
    const matchesSearch = !searchQuery ||
      pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.category.toLowerCase().includes(searchQuery.toLowerCase())

    const prog = progressMap.get(pack.id)
    const known = knownMap.get(pack.id) ?? 0
    const allKnown = known >= pack.wordCount && pack.wordCount > 0
    const hasProgress = prog != null
    const hasCompleted = prog?.completedAt != null

    const matchesStatus =
      activeFilter === 'new'       ? !hasProgress :
      activeFilter === 'started'   ? (hasProgress && !hasCompleted && !allKnown) :
      activeFilter === 'completed' ? (hasCompleted && !allKnown) :
      activeFilter === 'mastered'  ? allKnown :
      activeFilter === null ? true :
      true

    const matchesLevel = activeLevel == null || pack.level === activeLevel
    const matchesCat = activeCategory == null || pack.category === activeCategory

    return matchesSearch && matchesStatus && matchesLevel && matchesCat
  })

  function clearFilters() {
    setSearch('')
    setFilter(null)
    setLevel(null)
    setCategory(null)
  }

  const hasActiveFilters = !!searchQuery || activeFilter !== null || activeLevel != null || activeCategory != null

  return (
    <AppShell>
      <OnboardingModal />
      <div className="homepage">
        <InstallBanner />
        <OnboardingCard />
        <QuickStartCards />
        <StatsRow />
        <SearchBar />
        <FilterTabs />
        <SectionHeader label="Pakiety" count={filtered.length} />
        <div className="homepage__list" ref={listRef}>
          {!snapshot ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="homepage__card-skeleton skeleton" />
            ))
          ) : (
            <>
              {filtered.map(pack => (
                <PackageCard
                  key={pack.id}
                  pack={pack}
                  progress={progressMap.get(pack.id)}
                  knownCount={knownMap.get(pack.id) ?? 0}
                />
              ))}
              {filtered.length === 0 && (
                <div className="homepage__empty">
                  <p>Brak paczek dla wybranych filtrów</p>
                  {hasActiveFilters && (
                    <button className="homepage__empty-cta" onClick={clearFilters}>
                      Wyczyść filtry
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
