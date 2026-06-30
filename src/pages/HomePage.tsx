import { useEffect, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { InstallBanner } from '../components/home/InstallBanner'
import { QuickStartCards } from '../components/home/QuickStartCards'
import { StatsRow } from '../components/home/StatsRow'
import { SearchBar } from '../components/home/SearchBar'
import { FilterTabs } from '../components/home/FilterTabs'
import { SectionHeader } from '../components/home/SectionHeader'
import { PackageCard } from '../components/home/PackageCard'
import { useAppStore } from '../store/useAppStore'
import { getAllPackageProgress } from '../services/db'
import { PackageProgress } from '../types/progress'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './HomePage.css'

const allPacks = packagesIndex as PackMeta[]

export function HomePage() {
  const { searchQuery, activeFilter } = useAppStore()
  const [progressMap, setProgressMap] = useState<Map<string, PackageProgress>>(new Map())

  useEffect(() => {
    getAllPackageProgress().then(arr => {
      const map = new Map(arr.map(p => [p.packageId, p]))
      setProgressMap(map)
    })
  }, [])

  const filtered = allPacks.filter(pack => {
    const matchesSearch = !searchQuery ||
      pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.category.toLowerCase().includes(searchQuery.toLowerCase())

    const prog = progressMap.get(pack.id)

    if (activeFilter === 'started') return matchesSearch && prog && !prog.completedAt
    if (activeFilter === 'completed') return matchesSearch && prog?.completedAt != null
    return matchesSearch
  })

  return (
    <AppShell>
      <div className="homepage">
        <InstallBanner />
        <QuickStartCards />
        <StatsRow />
        <SearchBar />
        <FilterTabs />
        <SectionHeader label="Pakiety" count={filtered.length} />
        <div className="homepage__list">
          {filtered.map(pack => (
            <PackageCard
              key={pack.id}
              pack={pack}
              progress={progressMap.get(pack.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="homepage__empty">
              Brak paczek dla wybranych filtrów
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
