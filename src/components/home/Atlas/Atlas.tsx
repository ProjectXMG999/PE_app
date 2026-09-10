import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PackMeta } from '../../../types/vocabulary'
import { PackMemory } from '../../../utils/packMemory'
import { layoutAtlas, hitTest, AtlasNode } from './atlasLayout'
import {
  paintStatic, paintDynamic, sizeCanvas, readAtlasColors, AtlasColors, Monument,
} from './atlasPaint'
import { milestonesFor } from '../../../utils/packMilestones'
import './Atlas.css'

interface Props {
  packs: PackMeta[]
  memory: Map<string, PackMemory>
  frontierId: string | null
  /** Tapping a node hands the pack id back so the list can scroll to it. */
  onPick: (packId: string) => void
  /** Words known / 10 000 — the headline the map is captioned with. */
  knownWords: number
}

const ENTRANCE_MS = 1150

/**
 * The Atlas — all 864 packs as territory rather than rows.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * The product's promise is "10 000 słów, 4 poziomy, jedna mapa", and until now
 * the app had drawn that promise as a horizontal bar three separate times. This
 * is the only place where the whole route is visible at once, and the only
 * spatial object in the app.
 *
 * ── Why it does not melt a phone ─────────────────────────────────────────────
 *  - two canvases: the 864-node base is painted only when data or size changes;
 *    the marker/aurora layer is the only thing redrawn during motion;
 *  - the RAF loop **stops** when nothing is animating — no idle repaint, which
 *    is what actually drains a battery;
 *  - an IntersectionObserver parks the whole thing when it scrolls off screen;
 *  - DPR capped at 2, and not a single `filter: blur()` (glows are baked
 *    gradients instead).
 */
export function Atlas({ packs, memory, frontierId, onPick, knownWords }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const colorsRef = useRef<AtlasColors | null>(null)
  const rafRef = useRef(0)
  /** True once the entrance has played — it must not replay on every repaint. */
  const entranceRef = useRef(false)
  const [width, setWidth] = useState(0)
  const [onScreen, setOnScreen] = useState(true)
  const [selected, setSelected] = useState<AtlasNode | null>(null)

  const reduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ~40% of the viewport: enough to read as terrain, short enough that the
  // frontier bar and the first packs are still on screen without scrolling.
  const maxHeight = Math.round(
    Math.min(400, Math.max(260, (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.4)),
  )

  const layout = useMemo(
    () => (width > 0 ? layoutAtlas(packs, { width, maxHeight }) : null),
    [packs, width, maxHeight],
  )

  const frontierIndex = useMemo(() => {
    if (!layout || !frontierId) return layout ? layout.nodes.length - 1 : 0
    const i = layout.nodes.findIndex(n => n.id === frontierId)
    return i >= 0 ? i : 0
  }, [layout, frontierId])

  const frontierNode = layout?.nodes[frontierIndex] ?? null

  // The four stations, located by cumulative curriculum words (not by the
  // pack's difficulty tag, which interleaves along the route).
  const monuments = useMemo<Monument[]>(() => {
    if (!layout) return []
    const stations = milestonesFor(packs)
    const out: Monument[] = []
    layout.nodes.forEach((node, index) => {
      const m = stations.get(node.id)
      if (m?.kind === 'station' && m.level) {
        out.push({ index, words: m.words, level: m.level.level })
      }
    })
    return out
  }, [layout, packs])

  // ── Measure ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0].contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Static layer: expensive, so only on data/size change ───────────────────
  const repaintStatic = useCallback((progress: number) => {
    const canvas = baseRef.current
    if (!canvas || !layout) return
    const ctx = canvas.getContext('2d')
    if (!ctx || !colorsRef.current) return
    paintStatic(ctx, { layout, memory, colors: colorsRef.current, frontierIndex, monuments, progress })
  }, [layout, memory, frontierIndex, monuments])

  useEffect(() => {
    const base = baseRef.current
    const live = liveRef.current
    if (!base || !live || !layout) return
    colorsRef.current = readAtlasColors(document.documentElement)
    sizeCanvas(base, layout.width, layout.height)
    sizeCanvas(live, layout.width, layout.height)
    repaintStatic(reduced || entranceRef.current ? 1 : 0)
  }, [layout, repaintStatic, reduced])

  // ── Entrance: the ONLY thing that runs a rAF loop ──────────────────────────
  // Once the route has drawn itself the loop stops for good. The resting pulse
  // is CSS on `.atlas__pin`, so there is no idle repaint at all.
  useEffect(() => {
    if (!layout) return
    const ctx = liveRef.current?.getContext('2d')
    if (!ctx || !colorsRef.current) return

    const paintOnce = () => paintDynamic(ctx, {
      layout, colors: colorsRef.current!, frontier: frontierNode, selected,
    })

    if (reduced || entranceRef.current) {
      repaintStatic(1)
      paintOnce()
      return
    }

    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / ENTRANCE_MS)
      // ease-out-expo, matching --ease-out-expo used everywhere else
      repaintStatic(t === 1 ? 1 : 1 - Math.pow(2, -10 * t))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = 0
        entranceRef.current = true
        paintOnce()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [layout, frontierNode, selected, reduced, repaintStatic])

  // ── Follow theme changes ───────────────────────────────────────────────────
  // The canvas reads its palette from CSS custom properties once, so a theme
  // toggle would otherwise leave a dark-theme map on a light page.
  useEffect(() => {
    const el = document.documentElement
    const refresh = () => {
      colorsRef.current = readAtlasColors(el)
      repaintStatic(1)
    }
    const mo = new MutationObserver(refresh)
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener('change', refresh)
    return () => { mo.disconnect(); mq.removeEventListener('change', refresh) }
  }, [repaintStatic])

  // ── Park the CSS pulse when off screen ────────────────────────────────────
  // Nothing to stop on the canvas any more (the entrance loop ends by itself),
  // but the marker's CSS animation is worth pausing so it isn't compositing
  // frames for a map nobody is looking at.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || reduced) return
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  const pick = useCallback((clientX: number, clientY: number) => {
    const canvas = liveRef.current
    if (!canvas || !layout) return
    const rect = canvas.getBoundingClientRect()
    const node = hitTest(layout, clientX - rect.left, clientY - rect.top)
    if (!node) return
    setSelected(node)
    onPick(node.id)
  }, [layout, onPick])

  return (
    <section className="atlas" aria-label="Mapa 10 000 słów">
      <header className="atlas__head">
        <p className="atlas__eyebrow">Twoja mapa</p>
        <p className="atlas__figure">
          <span className="atlas__value">{knownWords.toLocaleString('pl-PL')}</span>
          <span className="atlas__total">/ 10 000 słów</span>
        </p>
      </header>

      <div
        ref={wrapRef}
        className="atlas__stage"
        onPointerDown={e => pick(e.clientX, e.clientY)}
        role="presentation"
      >
        <canvas ref={baseRef} className="atlas__canvas" aria-hidden="true" />
        <canvas ref={liveRef} className="atlas__canvas atlas__canvas--live" aria-hidden="true" />
        {/* "You are here". A DOM element rather than canvas pixels so its pulse
            is a compositor-only CSS animation — see paintDynamic's note. */}
        {frontierNode && (
          <span
            className={`atlas__pin${onScreen ? ' is-live' : ''}`}
            style={{ left: `${frontierNode.x}px`, top: `${frontierNode.y}px` }}
            aria-hidden="true"
          />
        )}
      </div>
    </section>
  )
}
