import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { InstallBanner } from '../components/home/InstallBanner'
import { OnboardingCard } from '../components/home/OnboardingCard'
import { OnboardingModal } from '../components/onboarding/OnboardingModal'
import { MemoryStrip } from '../components/home/MemoryStrip'
import { RouteControls } from '../components/home/RouteControls'
import { HerePill } from '../components/home/HerePill'
import { LevelSection } from '../components/home/LevelSection'
import { VolumeSection } from '../components/home/VolumeSection'
import { MilestoneBand } from '../components/home/MilestoneBand'
import { PackageCard } from '../components/home/PackageCard'
import { useProgressData } from '../hooks/useProgressData'
import { useAppStore } from '../store/useAppStore'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import { buildPackMemory, fadingPacks } from '../utils/packMemory'
import { milestonesFor } from '../utils/packMilestones'
import { categoryStats, nearlySealedByPack } from '../utils/packProfile'
import {
  EMPTY_FILTERS,
  LensContext,
  PackFilters,
  PackLens,
  facetCounts,
  filterPacksByQuery,
  filtersActive,
  isJumpQuery,
  frontierPack,
  groupByLevel,
  groupByVolume,
  levelStats,
  packMatchesLens,
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

const COLLAPSED_KEY = 'pe-home-collapsed'
const SCROLL_KEY = 'pe-home-scroll'
const RESULT_PAGE = 40

function readCollapsed(): Set<string> | null {
  try {
    const raw = sessionStorage.getItem(COLLAPSED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch { return null }
}

function persistCollapsed(next: Set<string>) {
  try { sessionStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])) } catch { /* private mode */ }
}

/** URL ⇄ filters. Keeping them in the address bar makes a lens linkable and
 *  survives a refresh — goal E4, which sessionStorage alone never satisfied. */
function filtersFromParams(p: URLSearchParams): PackFilters {
  const level = parseInt(p.get('poziom') ?? '', 10)
  return {
    query: p.get('q') ?? '',
    level: Number.isFinite(level) && level >= 1 && level <= 4 ? level : null,
    cat: p.get('kategoria'),
    lens: (p.get('soczewka') as PackLens) ?? 'all',
  }
}

function paramsFromFilters(f: PackFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.query.trim()) p.set('q', f.query)
  if (f.level != null) p.set('poziom', String(f.level))
  if (f.cat) p.set('kategoria', f.cat)
  if (f.lens !== 'all') p.set('soczewka', f.lens)
  return p
}

export function HomePage() {
  const snapshot = useProgressData()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => filtersFromParams(params), [params])
  const active = filtersActive(filters)

  const setFilters = useCallback((patch: Partial<PackFilters>) => {
    setParams(paramsFromFilters({ ...filtersFromParams(params), ...patch }), { replace: true })
  }, [params, setParams])

  const clearFilters = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true })
  }, [setParams])

  // Dzisiaj's "Przeglądaj poziom" hands off through the store (it predates the
  // URL being the source of truth here). Consume it once on mount and clear it,
  // so the handoff keeps working without Dzisiaj needing to know about the URL.
  const storeLevel = useAppStore(s => s.activeLevel)
  const setStoreLevel = useAppStore(s => s.setLevel)
  useEffect(() => {
    if (storeLevel == null) return
    setStoreLevel(null)
    setParams(paramsFromFilters({ ...EMPTY_FILTERS, level: storeLevel }), { replace: true })
    // Mount-only: this is a one-shot handoff, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const fadingMetas = useMemo(() => {
    const ids = new Set(fadingPacks(memory))
    return allPacks.filter(p => ids.has(p.id))
  }, [memory])

  // ── Result mode ───────────────────────────────────────────────────────────
  const results = useMemo(() => {
    if (!active) return []
    let out = allPacks.filter(p =>
      (filters.level == null || p.level === filters.level) &&
      (filters.cat == null || p.category === filters.cat) &&
      packMatchesLens(p, filters.lens, lensCtx))
    // Query last: it re-orders by match quality, and that ordering must win.
    // A jump query ("317") means "take me there", not "filter to this text" —
    // skip it here too, or combining it with a lens would fuzzy-match digits
    // against pack names and silently empty the list.
    if (filters.query.trim() && !isJumpQuery(filters.query)) out = filterPacksByQuery(out, filters.query)
    return out
  }, [active, filters, lensCtx])

  const [shown, setShown] = useState(RESULT_PAGE)
  useEffect(() => { setShown(RESULT_PAGE) }, [filters.query, filters.level, filters.cat, filters.lens])

  // ── Volumes: collapsed by default, except the one you're standing in ──────
  const [collapsed, setCollapsed] = useState<Set<string> | null>(readCollapsed)
  useEffect(() => {
    if (collapsed != null || !frontier) return
    setCollapsed(new Set(groups.map(g => g.volume).filter(v => v !== frontier.volume)))
  }, [collapsed, frontier, groups])

  const toggleVolume = useCallback((volume: string) => {
    setCollapsed(prev => {
      const next = new Set(prev ?? [])
      if (next.has(volume)) next.delete(volume)
      else next.add(volume)
      persistCollapsed(next)
      return next
    })
  }, [])

  // ── Scroll-spy: which volume is under the sticky bar ──────────────────────
  const [currentVolume, setCurrentVolume] = useState<string | null>(null)
  const headsRef = useRef(new Map<string, HTMLElement>())
  const headCb = useCallback((volume: string) => (node: HTMLElement | null) => {
    if (node) headsRef.current.set(volume, node)
    else headsRef.current.delete(volume)
  }, [])

  useEffect(() => {
    if (active) { setCurrentVolume(null); return }
    const root = document.querySelector('.appshell__main')
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) setCurrentVolume(e.target.getAttribute('data-volume'))
        }
      },
      // A thin band just under the sticky chrome: whichever header last crossed
      // it is the volume you're in.
      { root: root ?? null, rootMargin: '-25% 0px -70% 0px' },
    )
    headsRef.current.forEach(node => io.observe(node))
    return () => io.disconnect()
  }, [active, collapsed])

  // ── Jumping ───────────────────────────────────────────────────────────────
  /**
   * Scroll an element to just below the sticky chrome and *keep it there*.
   *
   * `scrollIntoView({ behavior: 'smooth' })` is not reliable on this page: the
   * list is still settling while the scroll animates — `content-visibility`
   * replaces estimated row heights with real ones, and an expanding volume adds
   * a hundred rows — so the target moves out from under a single computed
   * destination. Jumping to Tom VII landed on #333 that way. Re-aiming every
   * frame until the element actually sits where it should is what makes
   * "anywhere in two seconds" true rather than approximately true.
   *
   * The re-aiming used to just set `scrollTop` straight to the target each
   * frame, which — since the target is usually already at (nearly) its final
   * position after the first frame or two — meant the entire "jump" was one
   * instant teleport with no travel to it at all. It now closes a *fraction*
   * of the remaining distance every frame (classic ease-out damping: fast
   * first, decelerating into the landing), while still re-reading the live
   * target position each frame — so a target that's still moving under
   * layout settling gets naturally re-aimed instead of chased with a single
   * fixed-endpoint animation.
   */
  const homeOnto = useCallback((find: () => HTMLElement | null, pulse = false) => {
    const main = document.querySelector('.appshell__main') as HTMLElement | null
    const page = document.querySelector('.homepage') as HTMLElement | null
    if (!main) return
    const chrome = page
      ? parseFloat(getComputedStyle(page).getPropertyValue('--chrome-h')) || 0
      : 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let frames = 0
    let settled = 0
    const tick = () => {
      const el = find()
      // The row may not exist for a few frames — a filter reset has to re-render
      // the route and the volume body has to expand first.
      if (!el) {
        if (frames++ < 90) requestAnimationFrame(tick)
        return
      }
      const delta = el.getBoundingClientRect().top - main.getBoundingClientRect().top - chrome - 8
      const closeEnough = Math.abs(delta) < 1.5
      // Snap the final, imperceptible sliver shut instead of decaying toward
      // it forever; ease toward everything larger than that.
      main.scrollTop += closeEnough || reduced ? delta : delta * 0.22

      if (closeEnough) settled++
      else settled = 0

      // Three consecutive settled frames means the layout stopped moving.
      if (settled < 3 && frames++ < 90) { requestAnimationFrame(tick); return }
      if (pulse) {
        el.classList.add('packcard--pulse')
        window.setTimeout(() => el.classList.remove('packcard--pulse'), 2200)
      }
    }
    requestAnimationFrame(tick)
  }, [])

  const jumpToVolume = useCallback((volume: string) => {
    setCollapsed(prev => {
      const next = new Set(prev ?? [])
      next.delete(volume)
      persistCollapsed(next)
      return next
    })
    homeOnto(() => headsRef.current.get(volume) ?? null)
  }, [homeOnto])

  const jumpToPack = useCallback((packId: string) => {
    const pack = allPacks.find(p => p.id === packId)
    if (!pack) return
    if (active) clearFilters()
    setCollapsed(prev => {
      const next = new Set(prev ?? [])
      next.delete(pack.volume)
      persistCollapsed(next)
      return next
    })
    homeOnto(() => document.getElementById(`pack-${packId}`), true)
  }, [active, clearFilters, homeOnto])

  const jumpToFrontier = useCallback(() => {
    if (frontier) jumpToPack(frontier.id)
  }, [frontier, jumpToPack])

  // ── Coming back from a pack ───────────────────────────────────────────────
  /**
   * PackPreview's "Pakiety" hands the pack id back in the navigation state, so
   * you land on the row you just left rather than at a remembered pixel offset
   * — which was wrong whenever you'd reached the pack from Dzisiaj, a search or
   * a related-pack hop, and couldn't work at all when the pack's volume was
   * collapsed. jumpToPack expands that volume, clears any lens and pulses the
   * row, so "where was I" answers itself.
   *
   * Read before the scroll-restore block below on purpose: restore has to see
   * this on the very first render where the route is ready, or both would run
   * their own rAF loop and fight over scrollTop for a second.
   */
  const focusPack = (location.state as { focusPack?: string } | null)?.focusPack ?? null
  const focusedRef = useRef(false)

  // ── Scroll restore (route mode only — a result list has no stable place) ──
  const restoredRef = useRef(false)
  useEffect(() => {
    const main = document.querySelector('.appshell__main')
    if (!main) return
    const onScroll = () => {
      if (!restoredRef.current) return
      try { sessionStorage.setItem(SCROLL_KEY, String(main.scrollTop)) } catch { /* private mode */ }
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (restoredRef.current || focusPack || !snapshot || collapsed == null || active) return
    const saved = parseInt(sessionStorage.getItem(SCROLL_KEY) ?? '', 10)
    const main = document.querySelector('.appshell__main') as HTMLElement | null
    if (!main || !Number.isFinite(saved) || saved <= 0) { restoredRef.current = true; return }
    // The list keeps growing for many frames as content-visibility measures real
    // card heights, so keep re-applying the target until it sticks.
    let tries = 0
    const tick = () => {
      main.scrollTop = saved
      if (Math.abs(main.scrollTop - saved) > 2 && tries++ < 60) requestAnimationFrame(tick)
      else restoredRef.current = true
    }
    requestAnimationFrame(tick)
  }, [snapshot, collapsed, active, focusPack])

  useEffect(() => {
    if (!focusPack || focusedRef.current) return
    // Wait for the route to actually exist — the card has to be renderable
    // before homeOnto can aim at it.
    if (!snapshot || collapsed == null) return
    focusedRef.current = true
    // Stops the restore effect from claiming the scroll once focusPack clears,
    // and re-arms persisting the position you actually end up at.
    restoredRef.current = true
    // Drops the handoff (and any stale lens) so a refresh doesn't jump again.
    navigate('/', { replace: true, state: null })
    jumpToPack(focusPack)
  }, [focusPack, snapshot, collapsed, navigate, jumpToPack])

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

  return (
    <AppShell>
      <OnboardingModal />
      <div className="homepage">
        {/* Only ever rendered when something is actually slipping. This screen
            opens on packs: anything that sits above the first card has to earn
            the space every single visit, and a coverage card that says "~0%" to
            a beginner spends the whole fold saying "you have nothing". The
            coverage estimate rides along as one line in the bar instead. */}
        {fadingMetas.length > 0 && (
          <aside className="homepage__aside">
            <MemoryStrip
              packs={fadingMetas}
              onPick={jumpToPack}
              onShowAll={() => setFilters({ lens: 'fading' })}
            />
          </aside>
        )}

        <div className="homepage__main">
          <InstallBanner />
          <OnboardingCard />

          <div className="homepage__chrome">
            <RouteControls
              filters={filters}
              onChange={setFilters}
              onClear={clearFilters}
              lensCounts={facets.lens}
              levelCounts={facets.level}
              categoryCounts={facets.category}
              resultCount={results.length}
              stats={stats}
              knownMap={snapshot?.knownMap ?? new Map()}
              knownWords={knownWords}
              groups={groups}
              groupStats={gStats}
              currentVolume={currentVolume}
              onPickVolume={jumpToVolume}
              onJump={jumpToPack}
            />
          </div>

          {!snapshot ? (
            <div className="homepage__list">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="homepage__skeleton skeleton" />
              ))}
            </div>
          ) : active ? (
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
          ) : (
            levels.map((lvl, li) => (
              <LevelSection key={lvl.level} group={lvl} stats={lStats[li]}>
                {lvl.volumes.map(g => (
                  <VolumeSection
                    key={g.volume}
                    group={g}
                    stats={statOfVolume.get(g.volume)!}
                    collapsed={collapsed?.has(g.volume) ?? false}
                    onToggle={() => toggleVolume(g.volume)}
                    headRef={headCb(g.volume)}
                  >
                    {g.packs.map((pack, i) => {
                      const m = milestones.get(pack.id)
                      return (
                        <Fragment key={pack.id}>
                          {m && <MilestoneBand milestone={m} knownWords={knownWords} />}
                          {card(pack, i)}
                        </Fragment>
                      )
                    })}
                  </VolumeSection>
                ))}
              </LevelSection>
            ))
          )}
        </div>
      </div>

      {!active && <HerePill frontier={frontier} onJump={jumpToFrontier} />}
    </AppShell>
  )
}
