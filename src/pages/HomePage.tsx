import { Fragment, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, PanInfo, motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { InstallBanner } from '../components/home/InstallBanner'
import { OnboardingCard } from '../components/home/OnboardingCard'
import { OnboardingModal } from '../components/onboarding/OnboardingModal'
import { MemoryStrip } from '../components/home/MemoryStrip'
import { RouteControls } from '../components/home/RouteControls'
import { RouteSwitcher } from '../components/home/RouteSwitcher'
import { HerePill } from '../components/home/HerePill'
import { MilestoneBand } from '../components/home/MilestoneBand'
import { PackageCard } from '../components/home/PackageCard'
import { EASE_OUT_EXPO } from '../components/today/motion'
import { useProgressData } from '../hooks/useProgressData'
import { useAppStore } from '../store/useAppStore'
import packagesIndex from '../data/packages-index.json'
import { LEVEL_COLORS, LEVEL_META } from '../data/levels'
import { PackMeta } from '../types/vocabulary'
import { plural } from '../utils/plural'
import { buildPackMemory, fadingPacks } from '../utils/packMemory'
import { milestonesFor } from '../utils/packMilestones'
import { categoryStats, nearlySealedByPack, secondsPerWord } from '../utils/packProfile'
import {
  LensContext,
  PackFilters,
  PackLens,
  facetCounts,
  filterPacksByQuery,
  isFilteringRoute,
  isSearching,
  isJumpQuery,
  frontierPack,
  groupByLevel,
  groupByVolume,
  levelStats,
  LENS_LABEL,
  packMatchesRouteFilter,
  routeFilterCounts,
  routeNumber,
  volumeStats,
} from '../utils/packRoute'
import './HomePage.css'

/**
 * `packages-index.json` is already in route order — the global `#NNN` in each id
 * runs 1…865 across every volume — so the file order IS the curriculum.
 * **Never re-sort it.** The previous version sorted by `pack.level`, which is a
 * difficulty tag that is *not* monotonic along the route, and that quietly
 * destroyed the one thing the product actually sells.
 */
const allPacks = packagesIndex as PackMeta[]

const SELECTED_KEY = 'pe-home-volume'
const SCROLL_KEY = 'pe-home-scroll'
const RESULT_PAGE = 40
/** A horizontal swipe past this distance (px) or speed (px/s) changes volume. */
const SWIPE_DISTANCE = 70
const SWIPE_VELOCITY = 500

function readSelected(): string | null {
  try { return sessionStorage.getItem(SELECTED_KEY) } catch { return null }
}

function persistSelected(volume: string) {
  try { sessionStorage.setItem(SELECTED_KEY, volume) } catch { /* private mode */ }
}

/** URL ⇄ filters. Keeping them in the address bar makes a lens linkable and
 *  survives a refresh — goal E4, which sessionStorage alone never satisfied. */
function filtersFromParams(p: URLSearchParams): PackFilters {
  return {
    query: p.get('q') ?? '',
    cat: p.get('kategoria'),
    lens: (p.get('soczewka') as PackLens) ?? 'all',
  }
}

/** An old `?poziom=N` link: no longer a filter, now "open this level". */
function legacyLevelParam(p: URLSearchParams): number | null {
  const level = parseInt(p.get('poziom') ?? '', 10)
  return Number.isFinite(level) && level >= 1 && level <= 4 ? level : null
}

function paramsFromFilters(f: PackFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.query.trim()) p.set('q', f.query)
  if (f.cat) p.set('kategoria', f.cat)
  if (f.lens !== 'all') p.set('soczewka', f.lens)
  return p
}

/** Enter/exit for the volume stage, travelling in the direction you moved. */
const stageVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}

/**
 * PAKIETY — the route, one volume at a time.
 *
 * The screen used to be a single 864-row scroll with collapsible volumes, and
 * scrolling was the only way to move along it. Now the level and volume are
 * picked at the top (RouteSwitcher) and only that volume's packs are on the
 * page. The order is untouched: volumes are contiguous stretches of the route,
 * so picking one is a jump along the road, never a re-sort of it — and the
 * end of each volume hands you straight to the next.
 */
export function HomePage() {
  const snapshot = useProgressData()
  const location = useLocation()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => filtersFromParams(params), [params])
  /** Text search: the only mode that leaves the route for a flat list. */
  const searching = isSearching(filters)
  /** Stan / Kategoria: narrows the packs inside the selected volume. */
  const routeFiltering = isFilteringRoute(filters)

  const setFilters = useCallback((patch: Partial<PackFilters>) => {
    setParams(paramsFromFilters({ ...filtersFromParams(params), ...patch }), { replace: true })
  }, [params, setParams])

  const clearFilters = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true })
  }, [setParams])

  // ── Territory ─────────────────────────────────────────────────────────────
  const memory = useMemo(() => buildPackMemory(allPacks, snapshot), [snapshot])
  const sealing = useMemo(() => nearlySealedByPack(snapshot), [snapshot])
  const stats = useMemo(() => categoryStats(allPacks, snapshot), [snapshot])
  const lensCtx = useMemo<LensContext>(() => ({ snapshot, memory, sealing }), [snapshot, memory, sealing])
  // Each tab's counts are computed with the *other* two facets already
  // applied (facetCounts), not against the full 864-pack catalogue — see the
  // doc comment there for the bug that shipped without this.
  const facets = useMemo(() => facetCounts(allPacks, filters, lensCtx), [filters, lensCtx])

  const groups = useMemo(() => groupByVolume(allPacks), [])
  const gStats = useMemo(() => groups.map(g => volumeStats(g, snapshot)), [groups, snapshot])
  // Level → Tom → pack. Volumes are contiguous in route order and each is filed
  // under its majority level, so this adds structure without moving a pack.
  const levels = useMemo(() => groupByLevel(allPacks), [])
  const lStats = useMemo(() => levels.map(l => levelStats(l, snapshot)), [levels, snapshot])
  const statOfVolume = useMemo(
    () => new Map(groups.map((g, i) => [g.volume, gStats[i]])),
    [groups, gStats],
  )
  const milestones = useMemo(() => milestonesFor(allPacks), [])
  const frontier = useMemo(() => frontierPack(allPacks, snapshot), [snapshot])
  const knownWords = snapshot?.knownTotal ?? 0

  /** Route number of the pack immediately before each one — the "why now" line. */
  const prevNum = useMemo(() => {
    const m = new Map<string, number>()
    for (let i = 1; i < allPacks.length; i++) m.set(allPacks[i].id, routeNumber(allPacks[i - 1].id))
    return m
  }, [])

  /** Slipping packs, weakest first, with how much of each is still there. */
  const fading = useMemo(() => {
    const byId = new Map(allPacks.map(p => [p.id, p]))
    const items = fadingPacks(memory).flatMap(id => {
      const pack = byId.get(id)
      const m = memory.get(id)
      return pack && m ? [{ pack, strength: m.strength, known: m.known }] : []
    })
    // One pass over every known word in them, at the user's own measured pace.
    const words = items.reduce((sum, it) => sum + it.known, 0)
    const minutes = Math.ceil((words * secondsPerWord(snapshot)) / 60)
    return { items, minutes }
  }, [memory, snapshot])

  // ── Search results (flat, across the whole route) ─────────────────────────
  const results = useMemo(() => {
    if (!searching) return []
    let out = allPacks.filter(p => packMatchesRouteFilter(p, filters, lensCtx))
    // Query last: it re-orders by match quality, and that ordering must win.
    // A jump query ("317") means "take me there", not "filter to this text" —
    // skip it here too, or combining it with a lens would fuzzy-match digits
    // against pack names and silently empty the list.
    if (filters.query.trim() && !isJumpQuery(filters.query)) out = filterPacksByQuery(out, filters.query)
    return out
  }, [searching, filters, lensCtx])

  /** volume → packs passing Stan/Kategoria. Empty unless a filter is on. */
  const matchesByVolume = useMemo(
    () => routeFilterCounts(allPacks, filters, lensCtx),
    [filters, lensCtx],
  )
  const totalMatches = useMemo(
    () => [...matchesByVolume.values()].reduce((a, b) => a + b, 0),
    [matchesByVolume],
  )

  const [shown, setShown] = useState(RESULT_PAGE)
  useEffect(() => { setShown(RESULT_PAGE) }, [filters.query, filters.cat, filters.lens])

  // ── Which volume is on screen ─────────────────────────────────────────────
  const [selected, setSelected] = useState<string | null>(readSelected)
  /** +1 moving forward along the route, −1 back — drives the slide direction. */
  const [dir, setDir] = useState(1)
  const volumeIndex = useCallback((v: string | null) => groups.findIndex(g => g.volume === v), [groups])

  const chromeRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  /**
   * If the reader is further down than the top of the volume, put them back at
   * its start — a new volume opening mid-page, under whatever row you had
   * scrolled to in the old one, reads as a bug. If they're above it (the
   * banners are on screen) leave them where they are.
   */
  const scrollToStage = useCallback(() => {
    const main = document.querySelector('.appshell__main') as HTMLElement | null
    const stage = stageRef.current
    const chrome = chromeRef.current
    if (!main || !stage) return
    const stageTop = stage.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop
    const target = stageTop - (chrome?.offsetHeight ?? 0)
    if (main.scrollTop > target) main.scrollTop = Math.max(0, target)
  }, [])

  const selectedRef = useRef(selected)
  selectedRef.current = selected

  const selectVolume = useCallback((volume: string, opts: { scroll?: boolean } = {}) => {
    const prev = selectedRef.current
    if (prev !== volume) {
      setDir(volumeIndex(volume) >= volumeIndex(prev) ? 1 : -1)
      setSelected(volume)
      selectedRef.current = volume
    }
    persistSelected(volume)
    if (opts.scroll !== false) scrollToStage()
  }, [volumeIndex, scrollToStage])

  /** Nearest volume with filter matches: forward first, then back. */
  const nearestMatchingVolume = useCallback((from: string | null): string | null => {
    const i = volumeIndex(from)
    for (let k = Math.max(0, i); k < groups.length; k++) {
      if ((matchesByVolume.get(groups[k].volume) ?? 0) > 0) return groups[k].volume
    }
    for (let k = i - 1; k >= 0; k--) {
      if ((matchesByVolume.get(groups[k].volume) ?? 0) > 0) return groups[k].volume
    }
    return null
  }, [groups, matchesByVolume, volumeIndex])

  // Default: the volume your next pack lives in. Also repairs a stored label
  // that no longer exists (a renamed volume in a content update).
  useEffect(() => {
    if (!snapshot) return
    if (selected && volumeIndex(selected) >= 0) return
    const fallback = frontier?.volume ?? groups[0]?.volume
    if (fallback) { setSelected(fallback); persistSelected(fallback) }
  }, [snapshot, selected, frontier, groups, volumeIndex])

  // Dzisiaj's "Przeglądaj poziom" hands a level off through the store. It used
  // to become a level *filter* (a flat result list); now it simply opens that
  // level — at your position if you're in it, otherwise its first unfinished
  // volume. Consumed once, after progress has loaded so "unfinished" is real.
  const storeLevel = useAppStore(s => s.activeLevel)
  const setStoreLevel = useAppStore(s => s.setLevel)
  const pendingLevel = useRef<number | null>(storeLevel ?? legacyLevelParam(params))
  useEffect(() => {
    if (storeLevel != null) setStoreLevel(null)
    if (legacyLevelParam(params) != null) setParams(paramsFromFilters(filters), { replace: true })
    // Mount-only: this is a one-shot handoff, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const level = pendingLevel.current
    if (level == null || !snapshot) return
    pendingLevel.current = null
    const group = levels.find(l => l.level === level)
    if (!group) return
    const here = group.volumes.find(v => v.volume === frontier?.volume)
    const open = group.volumes.find(v => {
      const s = statOfVolume.get(v.volume)
      return s ? s.done < s.packs : true
    })
    selectVolume((here ?? open ?? group.volumes[0]).volume)
  }, [snapshot, levels, frontier, statOfVolume, selectVolume])

  // ── Stuck state: glass behind the chrome only while it is pinned ─────────
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting),
      { root: document.querySelector('.appshell__main'), threshold: 0 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  // ── Sticky chrome height ──────────────────────────────────────────────────
  // The chrome is now the search bar *plus* the switcher, so the scroll target
  // offset has to track the whole block — RouteControls only measures itself.
  useEffect(() => {
    const el = chromeRef.current
    const page = el?.closest('.homepage') as HTMLElement | null
    if (!el || !page) return
    const publish = () => page.style.setProperty('--chrome-h', `${Math.round(el.offsetHeight)}px`)
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Jumping ───────────────────────────────────────────────────────────────
  /**
   * Scroll an element to just below the sticky chrome and *keep it there*.
   *
   * `scrollIntoView({ behavior: 'smooth' })` is not reliable here: the target
   * row may not exist yet (the volume is switching) and `content-visibility`
   * replaces estimated row heights with real ones while the scroll animates. So
   * this re-reads the live position every frame and closes a fraction of the
   * remaining distance — fast first, decelerating into the landing.
   */
  const homeOnto = useCallback((find: () => HTMLElement | null, pulse = false) => {
    const main = document.querySelector('.appshell__main') as HTMLElement | null
    if (!main) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let frames = 0
    let settled = 0
    const tick = () => {
      const el = find()
      if (!el) {
        if (frames++ < 90) requestAnimationFrame(tick)
        return
      }
      const chrome = chromeRef.current?.offsetHeight ?? 0
      const delta = el.getBoundingClientRect().top - main.getBoundingClientRect().top - chrome - 8
      const closeEnough = Math.abs(delta) < 1.5
      main.scrollTop += closeEnough || reducedMotion ? delta : delta * 0.22

      if (closeEnough) settled++
      else settled = 0

      if (settled < 3 && frames++ < 90) { requestAnimationFrame(tick); return }
      if (pulse) {
        el.classList.add('packcard--pulse')
        window.setTimeout(() => el.classList.remove('packcard--pulse'), 2200)
      }
    }
    requestAnimationFrame(tick)
  }, [])

  const jumpToPack = useCallback((packId: string) => {
    const pack = allPacks.find(p => p.id === packId)
    if (!pack) return
    // A search list or a filter that hides the pack would leave nothing to land
    // on, so jumping clears whichever of them is in the way.
    if (searching || (routeFiltering && !packMatchesRouteFilter(pack, filters, lensCtx))) clearFilters()
    selectVolume(pack.volume, { scroll: false })
    homeOnto(() => document.getElementById(`pack-${packId}`), true)
  }, [searching, routeFiltering, filters, lensCtx, clearFilters, selectVolume, homeOnto])

  const jumpToFrontier = useCallback(() => {
    if (frontier) jumpToPack(frontier.id)
  }, [frontier, jumpToPack])

  // ── Coming back from a pack ───────────────────────────────────────────────
  /**
   * PackPreview's "Pakiety" hands the pack id back in the navigation state, so
   * you land on the row you just left — in its volume — rather than at a
   * remembered pixel offset, which was wrong whenever you'd reached the pack
   * from Dzisiaj, a search or a related-pack hop.
   */
  const focusPack = (location.state as { focusPack?: string } | null)?.focusPack ?? null
  const focusedRef = useRef(false)
  useEffect(() => {
    if (!focusPack || focusedRef.current || !snapshot) return
    focusedRef.current = true
    restoredRef.current = true
    navigate({ search: location.search }, { replace: true, state: null })
    jumpToPack(focusPack)
  }, [focusPack, snapshot, navigate, jumpToPack])

  // ── Scroll restore (per volume) ───────────────────────────────────────────
  // Only meaningful for the volume you left: another volume has other rows.
  const restoredRef = useRef(false)
  useEffect(() => {
    const main = document.querySelector('.appshell__main')
    if (!main) return
    const onScroll = () => {
      if (!restoredRef.current || !selected) return
      try {
        sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ v: selected, top: main.scrollTop }))
      } catch { /* private mode */ }
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [selected])

  useEffect(() => {
    if (restoredRef.current || focusPack || !snapshot || !selected || searching) return
    const main = document.querySelector('.appshell__main') as HTMLElement | null
    let saved: { v?: string; top?: number } | null = null
    try { saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? 'null') } catch { saved = null }
    if (!main || !saved || saved.v !== selected || !(Number(saved.top) > 0)) { restoredRef.current = true; return }
    const top = Number(saved.top)
    let tries = 0
    const tick = () => {
      // A pack focus can arrive a frame later (the back button pops history,
      // then hands the pack id over) — it wins over the remembered offset.
      if (focusedRef.current) { restoredRef.current = true; return }
      main.scrollTop = top
      if (Math.abs(main.scrollTop - top) > 2 && tries++ < 60) requestAnimationFrame(tick)
      else restoredRef.current = true
    }
    requestAnimationFrame(tick)
  }, [snapshot, selected, searching, focusPack])

  // ── A filter was switched on or changed: go where its packs are ───────────
  // If the volume on screen has none, move to the nearest one that does —
  // forward along the route first, since that is where you are heading.
  // Only on a filter change: tapping an empty volume chip on purpose stays put.
  const filterKey = routeFiltering ? `${filters.lens}|${filters.cat ?? ''}` : ''
  useEffect(() => {
    if (!filterKey || !snapshot) return
    const cur = selectedRef.current
    if (!cur || (matchesByVolume.get(cur) ?? 0) > 0) return
    const target = nearestMatchingVolume(cur)
    if (target) selectVolume(target)
    // matchesByVolume is derived from the same filter; re-running on its
    // identity would fight a deliberate tap on an empty volume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, snapshot])

  // ── Swipe between volumes ─────────────────────────────────────────────────
  const selIdx = volumeIndex(selected)
  const current = selIdx >= 0 ? groups[selIdx] : null
  const prevVolume = selIdx > 0 ? groups[selIdx - 1] : null
  const nextVolume = selIdx >= 0 && selIdx < groups.length - 1 ? groups[selIdx + 1] : null

  // A mouse drag still ends in a click on whatever card it started on; this
  // swallows that one click so a swipe never also opens a pack.
  const draggedAt = useRef(0)
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const far = Math.abs(info.offset.x) > SWIPE_DISTANCE || Math.abs(info.velocity.x) > SWIPE_VELOCITY
    if (Math.abs(info.offset.x) > 6) draggedAt.current = Date.now()
    if (!far) return
    if (info.offset.x < 0 && nextVolume) selectVolume(nextVolume.volume)
    else if (info.offset.x > 0 && prevVolume) selectVolume(prevVolume.volume)
  }
  const swallowDragClick = (e: MouseEvent) => {
    if (Date.now() - draggedAt.current < 250) { e.preventDefault(); e.stopPropagation() }
  }

  // ── Rows ──────────────────────────────────────────────────────────────────
  const card = (pack: PackMeta, i: number) => {
    // Słuchaj progress is the one axis that lives on PackageProgress rather
    // than in the memory map — currentIndex is how far playback got.
    const idx = snapshot?.progressMap.get(pack.id)?.currentIndex ?? 0
    return (
      <PackageCard
        key={pack.id}
        pack={pack}
        index={i}
        memory={memory.get(pack.id)}
        heardPct={pack.wordCount > 0 ? Math.min(100, (idx / pack.wordCount) * 100) : 0}
        isFrontier={frontier?.id === pack.id}
        prevNum={prevNum.get(pack.id)}
      />
    )
  }

  const visible = results.slice(0, shown)

  /** The packs of the volume on screen, narrowed by Stan/Kategoria if set. */
  const volumePacks = current
    ? (routeFiltering ? current.packs.filter(p => packMatchesRouteFilter(p, filters, lensCtx)) : current.packs)
    : []
  /** Human name of the active filter, for the header and the empty state. */
  const filterName = [
    filters.lens !== 'all' ? `„${LENS_LABEL[filters.lens]}"` : null,
    filters.cat,
  ].filter(Boolean).join(' · ')
  /** Where "Dalej na trasie" goes: the next volume, or while filtering the next
   *  one that actually has matches. */
  const nextStop = (() => {
    if (!current) return null
    if (!routeFiltering) return nextVolume
    for (let k = selIdx + 1; k < groups.length; k++) {
      if ((matchesByVolume.get(groups[k].volume) ?? 0) > 0) return groups[k]
    }
    return null
  })()
  const nearestElsewhere = routeFiltering && current && volumePacks.length === 0
    ? nearestMatchingVolume(current.volume)
    : null
  const currentLevel = current ? levels.find(l => l.volumes.some(v => v.volume === current.volume)) : null
  const levelMeta = currentLevel ? LEVEL_META.find(l => l.level === currentLevel.level) : null
  const curStats = current ? statOfVolume.get(current.volume) : undefined

  return (
    <AppShell>
      <OnboardingModal />
      <div className="homepage">
        {/* Only ever rendered when something is actually slipping. */}
        {fading.items.length > 0 && (
          <aside className="homepage__aside">
            <MemoryStrip
              items={fading.items}
              minutes={fading.minutes}
              onPick={jumpToPack}
              onShowAll={() => setFilters({ lens: 'fading' })}
            />
          </aside>
        )}

        <div className="homepage__main">
          <InstallBanner />
          <OnboardingCard />

          <div className="homepage__stick-sentinel" ref={sentinelRef} aria-hidden="true" />
          <div
            className={`homepage__chrome${!searching ? ' has-switcher' : ''}${stuck ? ' is-stuck' : ''}`}
            ref={chromeRef}
          >
            <RouteControls
              filters={filters}
              onChange={setFilters}
              onClear={clearFilters}
              lensCounts={facets.lens}
              categoryCounts={facets.category}
              resultCount={results.length}
              stats={stats}
              knownWords={knownWords}
              onJump={jumpToPack}
            />
            {/* Hidden only while searching: search results span the whole route,
                so a "you are in Tom IV" control would be a lie. A Stan or
                Kategoria filter keeps it, with a match count on every stop. */}
            {!searching && snapshot && current && (
              <RouteSwitcher
                levels={levels}
                levelStats={lStats}
                volumeStats={statOfVolume}
                selected={current.volume}
                frontierVolume={frontier?.volume ?? null}
                onSelect={v => selectVolume(v)}
                matches={routeFiltering ? matchesByVolume : null}
              />
            )}
          </div>

          {!snapshot || (!searching && !current) ? (
            <div className="homepage__list">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="homepage__skeleton skeleton" />
              ))}
            </div>
          ) : searching ? (
            <div className="homepage__list homepage__list--results">
              {visible.map(card)}
              {results.length === 0 && (
                <div className="homepage__empty">
                  <p>Żaden pakiet nie pasuje do tej soczewki.</p>
                  <button className="homepage__empty-cta" onClick={clearFilters}>Wróć na trasę</button>
                </div>
              )}
              {shown < results.length && (
                <button className="homepage__more" onClick={() => setShown(n => n + RESULT_PAGE)}>
                  Pokaż więcej ({(results.length - shown).toLocaleString('pl-PL')})
                </button>
              )}
            </div>
          ) : current && (
            <div className="homepage__stage" ref={stageRef}>
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <motion.section
                  key={current.volume}
                  className="homepage__volume"
                  custom={dir}
                  variants={stageVariants}
                  initial={reduced ? false : 'enter'}
                  animate="center"
                  exit={reduced ? undefined : 'exit'}
                  transition={{ duration: reduced ? 0 : 0.22, ease: EASE_OUT_EXPO }}
                  drag="x"
                  dragDirectionLock
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.16}
                  dragSnapToOrigin
                  onDragEnd={onDragEnd}
                  onClickCapture={swallowDragClick}
                  aria-label={`Tom ${current.short}, pakiety ${current.firstNum}–${current.lastNum}`}
                >
                  <header
                    className="homepage__volhead"
                    style={{ '--lvl': currentLevel ? LEVEL_COLORS[currentLevel.level] : undefined } as CSSProperties}
                  >
                    <div className="homepage__volhead-top">
                      <h2 className="homepage__volhead-title">
                        Tom {current.short}
                        {levelMeta && <span className="homepage__volhead-level">{levelMeta.name}</span>}
                      </h2>
                      {curStats && (
                        <span className="homepage__volhead-count">
                          <b>{curStats.done}</b>/{curStats.packs}
                        </span>
                      )}
                    </div>
                    {levelMeta && <p className="homepage__volhead-promise">{levelMeta.promise}</p>}
                    <div className="homepage__volhead-meter" aria-hidden="true">
                      <span style={{ width: `${Math.round(curStats?.pct ?? 0)}%` }} />
                    </div>
                    <p className="homepage__volhead-meta">
                      {routeFiltering
                        ? <><b className="homepage__volhead-match">{volumePacks.length}</b> z {current.packs.length} pasuje · {filterName}</>
                        : <>Pakiety {current.firstNum}–{current.lastNum} · {curStats?.done ?? 0} z {current.packs.length} ukończonych</>}
                    </p>
                  </header>

                  {volumePacks.length > 0 ? (
                    <div className="homepage__list">
                      {volumePacks.map((pack, i) => {
                        // Landmarks mark positions on the full route; between
                        // filtered packs they would sit next to the wrong rows.
                        const m = routeFiltering ? undefined : milestones.get(pack.id)
                        return (
                          <Fragment key={pack.id}>
                            {m && <MilestoneBand milestone={m} knownWords={knownWords} />}
                            {card(pack, i)}
                          </Fragment>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="homepage__vol-empty">
                      <p className="homepage__vol-empty-text">
                        W Tomie {current.short} nie ma pakietów {filterName}.
                      </p>
                      {nearestElsewhere ? (
                        <button className="homepage__vol-empty-go" onClick={() => selectVolume(nearestElsewhere)}>
                          Przejdź do Tomu {groups[volumeIndex(nearestElsewhere)]?.short}
                          <span className="homepage__vol-empty-n">{matchesByVolume.get(nearestElsewhere)}</span>
                        </button>
                      ) : totalMatches === 0 ? (
                        <p className="homepage__vol-empty-sub">Na całej trasie nie ma takich pakietów.</p>
                      ) : null}
                      <button className="homepage__vol-empty-clear" onClick={() => setFilters({ lens: 'all', cat: null })}>
                        Wyczyść filtry
                      </button>
                    </div>
                  )}

                  {nextStop && (volumePacks.length > 0 || !routeFiltering) && (
                    <button className="homepage__next" onClick={() => selectVolume(nextStop.volume)}>
                      <span className="homepage__next-label">
                        {routeFiltering ? 'Dalej: następne pasujące' : 'Dalej na trasie'}
                      </span>
                      <span className="homepage__next-title">
                        {routeFiltering
                          ? `Tom ${nextStop.short} · ${matchesByVolume.get(nextStop.volume)} ${plural(matchesByVolume.get(nextStop.volume) ?? 0, 'pakiet', 'pakiety', 'pakietów')}`
                          : `Tom ${nextStop.short} · pakiety ${nextStop.firstNum}–${nextStop.lastNum}`}
                      </span>
                      <svg className="homepage__next-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  )}
                </motion.section>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Not over an empty filtered volume: there the empty state's own button
          is the next step, and the floating pill landed right on top of it. */}
      {!searching && !(routeFiltering && current && volumePacks.length === 0) && (
        <HerePill
          frontier={frontier}
          onJump={jumpToFrontier}
          scope={selected}
          elsewhere={!!frontier && !!selected && frontier.volume !== selected}
        />
      )}
    </AppShell>
  )
}
