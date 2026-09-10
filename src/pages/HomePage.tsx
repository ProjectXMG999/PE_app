import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { InstallBanner } from '../components/home/InstallBanner'
import { QuickStartCards } from '../components/home/QuickStartCards'
import { StatsRow } from '../components/home/StatsRow'
import { FilterTabs } from '../components/home/FilterTabs'
import { LevelProgressBars } from '../components/home/LevelProgressBars'
import { LevelBandHeader } from '../components/home/LevelBandHeader'
import { SectionHeader } from '../components/home/SectionHeader'
import { PackageCard } from '../components/home/PackageCard'
import { OnboardingCard } from '../components/home/OnboardingCard'
import { OnboardingModal } from '../components/onboarding/OnboardingModal'
import { fadeUp, fadeUpReduced, staggerContainerWide } from '../components/today/motion'
import { useAppStore } from '../store/useAppStore'
import { useProgressData } from '../hooks/useProgressData'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './HomePage.css'

const allPacks = packagesIndex as PackMeta[]
const SCROLL_KEY = 'pe-home-scroll'
const VISIBLE_KEY = 'pe-home-visible'
const INITIAL_VISIBLE = 36
const VISIBLE_STEP = 24

function readVisible(): number {
  const v = parseInt(sessionStorage.getItem(VISIBLE_KEY) ?? '', 10)
  return Number.isFinite(v) && v >= INITIAL_VISIBLE ? v : INITIAL_VISIBLE
}

export function HomePage() {
  const { searchQuery, setSearch, activeFilter, setFilter, activeLevel, setLevel, activeCategory, setCategory } = useAppStore()
  const snapshot = useProgressData()
  const reduced = useReducedMotion()
  const variants = reduced ? fadeUpReduced : fadeUp

  const [visibleCount, setVisibleCount] = useState(readVisible)
  const visibleRef = useRef(visibleCount)
  visibleRef.current = visibleCount

  const filterSig = `${activeFilter}|${activeLevel}|${activeCategory}|${searchQuery}`
  const prevSigRef = useRef(filterSig)
  const restoredRef = useRef(false)

  // Persist scroll position + how many cards were loaded, lost when the route
  // unmounts on navigating into a pack. visibleCount comes back pre-paint via
  // the useState initializer; the scrollTop is re-applied once the real cards
  // exist (see the snapshot-gated effect below) so there's height to scroll to.
  useEffect(() => {
    const main = document.querySelector('.appshell__main')
    if (!main) return
    const onScroll = () => {
      // While the one-shot restore is still homing in, its intermediate
      // (scroll-anchoring) positions must not be persisted as the real one.
      if (!restoredRef.current) return
      sessionStorage.setItem(SCROLL_KEY, String(main.scrollTop))
      sessionStorage.setItem(VISIBLE_KEY, String(visibleRef.current))
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  // One-shot scroll restore, deferred until the pack list has rendered
  // (snapshot resolved). The list keeps growing in height for many frames as
  // content-visibility measures real card heights (and scroll-anchoring nudges
  // the position), so keep re-applying the target until it sticks.
  useEffect(() => {
    if (restoredRef.current || !snapshot) return
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (!saved) { restoredRef.current = true; return }
    const target = parseInt(saved, 10)
    if (!Number.isFinite(target) || target <= 0) { restoredRef.current = true; return }
    const main = document.querySelector('.appshell__main') as HTMLElement | null
    if (!main) return
    let tries = 0
    const tick = () => {
      main.scrollTop = target
      if (Math.abs(main.scrollTop - target) > 2 && tries++ < 60) {
        requestAnimationFrame(tick)
      } else {
        restoredRef.current = true
      }
    }
    requestAnimationFrame(tick)
  }, [snapshot])

  // A filter/search change collapses the window back to the first page and
  // jumps to the top — otherwise you'd land mid-list in an unrelated result set.
  useEffect(() => {
    if (prevSigRef.current === filterSig) return
    prevSigRef.current = filterSig
    setVisibleCount(INITIAL_VISIBLE)
    const main = document.querySelector('.appshell__main')
    if (main) main.scrollTop = 0
  }, [filterSig])

  const filtered = useMemo(() => {
    const progressMap = snapshot?.progressMap ?? new Map()
    const knownMap = snapshot?.knownMap ?? new Map<string, number>()
    const q = searchQuery.toLowerCase()

    const out = allPacks.filter(pack => {
      const matchesSearch = !searchQuery ||
        pack.name.toLowerCase().includes(q) ||
        pack.category.toLowerCase().includes(q)

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

    // Group by level (stable within a level) so the level-band headers land on
    // contiguous runs.
    return out
      .map((p, i) => [p, i] as const)
      .sort((a, b) => a[0].level - b[0].level || a[1] - b[1])
      .map(([p]) => p)
  }, [snapshot, searchQuery, activeFilter, activeLevel, activeCategory])

  // Infinite-scroll sentinel — grow the window as it nears the viewport. A
  // callback ref (re)binds the observer whenever the node mounts/unmounts, so
  // it survives the list re-keying on filter changes.
  const ioRef = useRef<IntersectionObserver | null>(null)
  const sentinelCb = useCallback((node: HTMLDivElement | null) => {
    ioRef.current?.disconnect()
    if (!node) return
    const root = document.querySelector('.appshell__main')
    ioRef.current = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) setVisibleCount(c => c + VISIBLE_STEP)
      },
      { root: root ?? null, rootMargin: '600px 0px' }
    )
    ioRef.current.observe(node)
  }, [])
  useEffect(() => () => ioRef.current?.disconnect(), [])

  function clearFilters() {
    setSearch('')
    setFilter(null)
    setLevel(null)
    setCategory(null)
  }

  const hasActiveFilters = !!searchQuery || activeFilter !== null || activeLevel != null || activeCategory != null
  const knownMap = snapshot?.knownMap ?? new Map<string, number>()
  const visible = filtered.slice(0, visibleCount)

  return (
    <AppShell>
      <OnboardingModal />
      <motion.div className="homepage" variants={staggerContainerWide} initial="hidden" animate="show">
        <motion.div variants={variants}><InstallBanner /></motion.div>
        <motion.div variants={variants}><StatsRow /></motion.div>
        <motion.div variants={variants}><OnboardingCard /></motion.div>
        <motion.div variants={variants}><QuickStartCards /></motion.div>
        <motion.div variants={variants}>
          <FilterTabs
            afterLevelRow={snapshot && <LevelProgressBars allPacks={allPacks} knownMap={knownMap} />}
          />
        </motion.div>
        <motion.div variants={variants}>
          <SectionHeader label="Pakiety" count={filtered.length} />
        </motion.div>

        <motion.div variants={variants}>
          <AnimatePresence mode="wait" initial={false}>
            {!snapshot ? (
              <motion.div
                key="sk"
                className="homepage__list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.15 }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="homepage__card-skeleton skeleton" />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={`ct-${filterSig}`}
                className="homepage__list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.18 }}
              >
                {visible.map((pack, i) => {
                  const showBand = activeLevel == null && pack.level !== visible[i - 1]?.level
                  return (
                    <Fragment key={pack.id}>
                      {showBand && <LevelBandHeader level={pack.level} />}
                      <PackageCard
                        pack={pack}
                        progress={snapshot.progressMap.get(pack.id)}
                        knownCount={knownMap.get(pack.id) ?? 0}
                      />
                    </Fragment>
                  )
                })}

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
              </motion.div>
            )}
          </AnimatePresence>

          {snapshot && visibleCount < filtered.length && (
            <div ref={sentinelCb} className="homepage__sentinel" aria-hidden="true" />
          )}
        </motion.div>
      </motion.div>
    </AppShell>
  )
}
