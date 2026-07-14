import { useEffect, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { InstallBanner } from '../components/home/InstallBanner'
import { QuickStartCards } from '../components/home/QuickStartCards'
import { StatsRow } from '../components/home/StatsRow'
import { SearchBar } from '../components/home/SearchBar'
import { FilterTabs } from '../components/home/FilterTabs'
import { LevelProgressBars } from '../components/home/LevelProgressBars'
import { SectionHeader } from '../components/home/SectionHeader'
import { PackageCard } from '../components/home/PackageCard'
import { useAppStore } from '../store/useAppStore'
import { getAllPackageProgress, getPackageWordProgress } from '../services/db'
import { PackageProgress } from '../types/progress'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './HomePage.css'

const allPacks = packagesIndex as PackMeta[]

export function HomePage() {
  const { searchQuery, activeFilter, activeLevel, activeCategory } = useAppStore()
  const [progressMap, setProgressMap] = useState<Map<string, PackageProgress>>(new Map())
  const [knownMap, setKnownMap] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    getAllPackageProgress().then(async arr => {
      const map = new Map(arr.map(p => [p.packageId, p]))
      setProgressMap(map)
      const knownEntries = await Promise.all(
        arr.map(async p => {
          const wp = await getPackageWordProgress(p.packageId)
          return [p.packageId, wp.filter(w => w.status === 'known').length] as [string, number]
        })
      )
      setKnownMap(new Map(knownEntries))
    })
  }, [])

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
      true

    const matchesLevel = activeLevel == null || pack.level === activeLevel
    const matchesCat = activeCategory == null || pack.category === activeCategory

    return matchesSearch && matchesStatus && matchesLevel && matchesCat
  })

  return (
    <AppShell>
      <div className="homepage">
        <InstallBanner />
        <QuickStartCards />
        <StatsRow />
        <SearchBar />
        <FilterTabs />
        <LevelProgressBars allPacks={allPacks} knownMap={knownMap} />
        <SectionHeader label="Pakiety" count={filtered.length} />
        <div className="homepage__list">
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
              Brak paczek dla wybranych filtrów
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
