import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { InstallBanner } from '../components/home/InstallBanner'
import { RouteStrip } from '../components/today/RouteStrip'
import { FrontierBar } from '../components/home/FrontierBar'
import { PackFilterBar } from '../components/home/PackFilterBar'
import { VolumeSection } from '../components/home/VolumeSection'
import { PackageCard } from '../components/home/PackageCard'
import { OnboardingModal } from '../components/onboarding/OnboardingModal'
import { fadeUp, fadeUpReduced, staggerContainerWide } from '../components/today/motion'
import { useProgressData } from '../hooks/useProgressData'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import {
  PackFilters,
  PackStatusFilter,
  filterPacksByQuery,
  filtersActive,
  frontierPack,
  groupByVolume,
  packMatchesStatus,
  volumeStats,
} from '../utils/packRoute'
import './HomePage.css'

const allPacks = packagesIndex as PackMeta[]
const VOLUME_GROUPS = groupByVolume(allPacks)
const SCROLL_KEY = 'pe-home-scroll'
const COLLAPSE_KEY = 'pe-home-volumes'
const FLAT_PAGE = 60

// One-time flag: the page-section entrance cascade only plays the first time
// Pakiety mounts in a session, not on every return from a pack.
let introPlayed = false

const VALID_STATUS: PackStatusFilter[] = ['new', 'started', 'completed', 'mastered']

function readFilters(p: URLSearchParams): PackFilters {
  const lvl = parseInt(p.get('level') ?? '', 10)
  const status = p.get('status') as PackStatusFilter | null
  return {
    query: p.get('q') ?? '',
    level: lvl >= 1 && lvl <= 4 ? lvl : null,
    cat: p.get('cat') || null,
    status: status && VALID_STATUS.includes(status) ? status : 'all',
  }
}

export function HomePage() {
  const [params, setParams] = useSearchParams()
  const snapshot = useProgressData()
  const reduced = useReducedMotion()
  const variants = reduced ? fadeUpReduced : fadeUp

  const filters = useMemo(() => readFilters(params), [params])
  const active = filtersActive(filters)

  const patchFilters = useCallback((patch: Partial<PackFilters>) => {
    setParams(prev => {
      const merged = { ...readFilters(prev), ...patch }
      const next = new URLSearchParams(prev)
      merged.query ? next.set('q', merged.query) : next.delete('q')
      merged.level != null ? next.set('level', String(merged.level)) : next.delete('level')
      merged.cat ? next.set('cat', merged.cat) : next.delete('cat')
      merged.status !== 'all' ? next.set('status', merged.status) : next.delete('status')
      return next
    }, { replace: true })
  }, [setParams])

  const clearFilters = useCallback(() => setParams({}, { replace: true }), [setParams])

  const frontier = useMemo(() => frontierPack(allPacks, snapshot), [snapshot])

  // ── Flat (filtered) view ────────────────────────────────────────────
  const flatList = useMemo(() => {
    if (!active) return [] as PackMeta[]
    let list = allPacks
    if (filters.cat) list = list.filter(p => p.category === filters.cat)
    if (filters.level != null) list = list.filter(p => p.level === filters.level)
    if (filters.status !== 'all') list = list.filter(p => packMatchesStatus(p, snapshot, filters.status))
    if (filters.query.trim()) list = filterPacksByQuery(list, filters.query)
    return list
  }, [active, filters, snapshot])

  const [flatShown, setFlatShown] = useState(FLAT_PAGE)
  useEffect(() => { setFlatShown(FLAT_PAGE) }, [filters])

  // ── Volume collapse state ───────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Set<string> | null>(() => {
    try {
      const saved = sessionStorage.getItem(COLLAPSE_KEY)
      if (saved) return new Set(JSON.parse(saved) as string[])
    } catch { /* ignore */ }
    return null
  })

  // Default once progress (hence the frontier) is known: everything collapsed
  // except the volume the frontier lives in.
  useEffect(() => {
    if (collapsed != null || !snapshot) return
    const fv = frontier?.volume
    setCollapsed(new Set(VOLUME_GROUPS.map(g => g.volume).filter(v => v !== fv)))
  }, [snapshot, frontier, collapsed])

  const persistCollapsed = (set: Set<string>) => {
    try { sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set])) } catch { /* ignore */ }
  }

  const toggleVolume = useCallback((v: string) => {
    setCollapsed(prev => {
      const next = new Set(prev ?? [])
      next.has(v) ? next.delete(v) : next.add(v)
      persistCollapsed(next)
      return next
    })
  }, [])

  // ── Scroll position persistence (survives navigating into a pack) ────
  const restoredRef = useRef(false)
  useEffect(() => {
    const main = document.querySelector('.appshell__main')
    if (!main) return
    const onScroll = () => {
      if (!restoredRef.current) return
      const top = (main as HTMLElement).scrollTop
      // A stray scroll-to-0 fires as the route tears down on navigating into a
      // pack — never let it clobber the real saved position (0 and "no value"
      // restore identically anyway).
      if (top <= 0) return
      try { sessionStorage.setItem(SCROLL_KEY, String(top)) } catch { /* ignore */ }
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (restoredRef.current || !snapshot || collapsed == null) return
    let target = NaN
    try { target = parseInt(sessionStorage.getItem(SCROLL_KEY) ?? '', 10) } catch { /* ignore */ }
    const main = document.querySelector('.appshell__main') as HTMLElement | null
    if (!main || !Number.isFinite(target) || target <= 0) {
      restoredRef.current = true
      return
    }
    // Re-apply on a schedule: content-visibility measures real card heights over
    // several frames after mount, so the list isn't tall enough to scroll to the
    // saved offset on the first assignment.
    const timers = [0, 40, 100, 200, 350, 550, 800].map(d =>
      window.setTimeout(() => {
        main.scrollTop = target
        if (d === 800) restoredRef.current = true
      }, d),
    )
    return () => timers.forEach(clearTimeout)
  }, [snapshot, collapsed])

  const jumpToFrontier = useCallback(() => {
    if (!frontier) return
    if (active) clearFilters()
    setCollapsed(prev => {
      const next = new Set(prev ?? [])
      next.delete(frontier.volume)
      persistCollapsed(next)
      return next
    })
    requestAnimationFrame(() => {
      const el = document.getElementById(`pack-${frontier.id}`)
      if (!el) return
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
      el.classList.add('packcard--pulse')
      window.setTimeout(() => el.classList.remove('packcard--pulse'), 2400)
    })
  }, [frontier, active, clearFilters, reduced])

  const [intro] = useState(() => !introPlayed)
  useEffect(() => { introPlayed = true }, [])

  // ── Scroll-spy: which volume is under the filter bar right now ───────
  const [currentVolume, setCurrentVolume] = useState<string | null>(null)
  const spyRef = useRef<IntersectionObserver | null>(null)
  const headsRef = useRef(new Map<string, HTMLElement>())

  // The observer only decides *when* to re-read; the answer itself comes from
  // geometry — the last header at or above the sticky bar. Deriving it from
  // per-entry isIntersecting made the result depend on callback order, which a
  // layout shift (expanding a volume) could scramble.
  const resolveVolume = useCallback(() => {
    const barBottom = (document.querySelector('.pfbar')?.getBoundingClientRect().bottom ?? 0) + 4
    let found: string | null = null
    for (const group of VOLUME_GROUPS) {
      const node = headsRef.current.get(group.volume)
      if (node && node.getBoundingClientRect().top <= barBottom) found = group.volume
    }
    setCurrentVolume(found)
  }, [])

  useEffect(() => {
    if (active) { setCurrentVolume(null); return }
    const root = document.querySelector('.appshell__main') as HTMLElement | null
    // Fires only when a header crosses the thin band under the bar — no
    // per-frame scroll work.
    const io = new IntersectionObserver(resolveVolume, {
      root, rootMargin: '-64px 0px -88% 0px', threshold: 0,
    })
    spyRef.current = io
    headsRef.current.forEach(node => io.observe(node))
    return () => { io.disconnect(); spyRef.current = null }
  }, [active, resolveVolume])

  // Toggling a volume animates its body 0 → auto for 280ms; the observer fires
  // mid-flight and would settle on whichever header was passing at that moment.
  // Re-read once the heights are final.
  useEffect(() => {
    if (active || collapsed == null) return
    const t = window.setTimeout(resolveVolume, 340)
    return () => clearTimeout(t)
  }, [collapsed, active, resolveVolume])

  const headRefFor = useCallback((volume: string) => (node: HTMLElement | null) => {
    const prev = headsRef.current.get(volume)
    if (prev) spyRef.current?.unobserve(prev)
    if (node) {
      headsRef.current.set(volume, node)
      spyRef.current?.observe(node)
    } else {
      headsRef.current.delete(volume)
    }
  }, [])

  const renderCard = (pack: PackMeta) => (
    <PackageCard
      key={pack.id}
      pack={pack}
      progress={snapshot?.progressMap.get(pack.id)}
      knownCount={snapshot?.knownMap.get(pack.id) ?? 0}
      isFrontier={frontier?.id === pack.id}
    />
  )

  return (
    <AppShell>
      <OnboardingModal />
      <motion.div
        className={`homepage ${intro ? 'homepage--intro' : ''}`}
        variants={staggerContainerWide}
        initial={intro ? 'hidden' : false}
        animate="show"
      >
        <motion.div variants={variants}><InstallBanner /></motion.div>

        <motion.div variants={variants}>
          <Link to="/postęp" className="homepage__routelink" viewTransition>
            <RouteStrip knownWords={snapshot?.knownTotal ?? 0} eyebrow={<>🗺️ Mapa · 10 000 słów</>} />
          </Link>
        </motion.div>

        {frontier && !active && (
          <motion.div variants={variants}>
            <FrontierBar frontier={frontier} onJump={jumpToFrontier} />
          </motion.div>
        )}

        <motion.div variants={variants} className="homepage__bar">
          <PackFilterBar
            filters={filters}
            onChange={patchFilters}
            onClear={clearFilters}
            resultCount={active ? flatList.length : allPacks.length}
            total={allPacks.length}
            snapshot={snapshot}
            currentVolume={currentVolume}
          />
        </motion.div>

        <motion.div variants={variants} className="homepage__body">
          {!snapshot ? (
            <div className="homepage__list">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="homepage__card-skeleton skeleton" />
              ))}
            </div>
          ) : active ? (
            <div className="homepage__list">
              {flatList.slice(0, flatShown).map(renderCard)}
              {flatList.length === 0 && (
                <div className="homepage__empty">
                  <p>Brak pakietów dla wybranych filtrów</p>
                  <button className="homepage__empty-cta" onClick={clearFilters}>Wyczyść filtry</button>
                </div>
              )}
              {flatShown < flatList.length && (
                <button className="homepage__more" onClick={() => setFlatShown(n => n + FLAT_PAGE)}>
                  Pokaż więcej ({(flatList.length - flatShown).toLocaleString('pl-PL')})
                </button>
              )}
            </div>
          ) : (
            <div className="homepage__volumes">
              {VOLUME_GROUPS.map(group => {
                const isCollapsed = collapsed?.has(group.volume) ?? false
                return (
                  <VolumeSection
                    key={group.volume}
                    group={group}
                    stats={volumeStats(group, snapshot)}
                    collapsed={isCollapsed}
                    onToggle={() => toggleVolume(group.volume)}
                    headRef={headRefFor(group.volume)}
                  >
                    {!isCollapsed && group.packs.map(renderCard)}
                  </VolumeSection>
                )
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AppShell>
  )
}
