import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PackMeta } from '../../../types/vocabulary'
import { PackMemory } from '../../../utils/packMemory'
import { layoutAtlas, hitTest, AtlasNode, NEIGHBOURHOOD } from './atlasLayout'
import {
  paintStatic, paintDynamic, sizeCanvas, readAtlasColors, AtlasColors,
} from './atlasPaint'
import { Minimap } from './Minimap'
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

const ENTRANCE_MS = 900

/**
 * The Atlas — the route as ground you can stand on.
 *
 * ── What changed, and why ────────────────────────────────────────────────────
 * The first version drew all 864 packs at once. That was a texture: illegible,
 * un-tappable, and mostly a picture of how much you haven't done. This shows a
 * neighbourhood of ~48 packs at a size where each one carries its route number
 * and can be hit with a thumb, with `Minimap` keeping the whole 864 for scale.
 * Maps show you your surroundings; the world goes in the inset.
 *
 * ── Why it does not melt a phone ─────────────────────────────────────────────
 *  - two canvases: the nodes/road layer repaints only on data or window change;
 *  - the rAF loop runs for the ~0.9 s entrance and then STOPS — the frontier's
 *    resting pulse is a CSS animation on a DOM element, so there is no idle
 *    repaint at all (measured: 0 rAF calls across 3 s idle);
 *  - DPR capped at 2, and not one `filter: blur()` (glows are baked gradients).
 */
export function Atlas({ packs, memory, frontierId, onPick, knownWords }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const colorsRef = useRef<AtlasColors | null>(null)
  const rafRef = useRef(0)
  const entranceRef = useRef(false)
  const [width, setWidth] = useState(0)
  const [onScreen, setOnScreen] = useState(true)
  const [selected, setSelected] = useState<AtlasNode | null>(null)
  /** Catalogue index the window is centred on; null = follow the frontier. */
  const [center, setCenter] = useState<number | null>(null)

  const reduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const frontierGlobal = useMemo(() => {
    const i = frontierId ? packs.findIndex(p => p.id === frontierId) : -1
    return i >= 0 ? i : 0
  }, [packs, frontierId])

  const layout = useMemo(
    () => (width > 0
      ? layoutAtlas(packs, {
          width,
          maxHeight: 250,
          center: center ?? frontierGlobal,
          count: NEIGHBOURHOOD,
        })
      : null),
    [packs, width, center, frontierGlobal],
  )

  const frontierNode = useMemo(
    () => layout?.nodes.find(n => n.globalIndex === frontierGlobal) ?? null,
    [layout, frontierGlobal],
  )

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

  const repaintStatic = useCallback((progress: number) => {
    const canvas = baseRef.current
    if (!canvas || !layout || !colorsRef.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    paintStatic(ctx, { layout, memory, colors: colorsRef.current, frontierGlobal, progress })
  }, [layout, memory, frontierGlobal])

  const repaintDynamic = useCallback(() => {
    const ctx = liveRef.current?.getContext('2d')
    if (!ctx || !layout || !colorsRef.current) return
    paintDynamic(ctx, { layout, colors: colorsRef.current, frontier: frontierNode, selected })
  }, [layout, frontierNode, selected])

  // ── Size + first paint ─────────────────────────────────────────────────────
  useEffect(() => {
    const base = baseRef.current
    const live = liveRef.current
    if (!base || !live || !layout) return
    colorsRef.current = readAtlasColors(document.documentElement)
    sizeCanvas(base, layout.width, layout.height)
    sizeCanvas(live, layout.width, layout.height)
    repaintStatic(reduced || entranceRef.current ? 1 : 0)
    repaintDynamic()
  }, [layout, repaintStatic, repaintDynamic, reduced])

  // ── Entrance: the ONLY rAF loop, and it ends ───────────────────────────────
  useEffect(() => {
    if (!layout || reduced || entranceRef.current) return
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
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
  }, [layout, reduced, repaintStatic])

  useEffect(() => { repaintDynamic() }, [repaintDynamic])

  // ── Follow theme changes ───────────────────────────────────────────────────
  // The canvas reads its palette from CSS custom properties once, so a theme
  // toggle would otherwise leave a dark-theme map on a light page.
  useEffect(() => {
    const el = document.documentElement
    const refresh = () => {
      colorsRef.current = readAtlasColors(el)
      repaintStatic(1)
      repaintDynamic()
    }
    const mo = new MutationObserver(refresh)
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener('change', refresh)
    return () => { mo.disconnect(); mq.removeEventListener('change', refresh) }
  }, [repaintStatic, repaintDynamic])

  // Park the CSS pulse when the map scrolls away — nothing to stop on canvas.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || reduced) return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  const tap = useCallback((clientX: number, clientY: number) => {
    const canvas = liveRef.current
    if (!canvas || !layout) return
    const rect = canvas.getBoundingClientRect()
    const node = hitTest(layout, clientX - rect.left, clientY - rect.top)
    if (!node) return
    setSelected(node)
    onPick(node.id)
  }, [layout, onPick])

  const windowLabel = layout
    ? `#${layout.nodes[0]?.num ?? 1}–#${layout.nodes[layout.nodes.length - 1]?.num ?? 1}`
    : ''
  const offFrontier = center != null && frontierNode == null

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
        onPointerDown={e => tap(e.clientX, e.clientY)}
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

      <div className="atlas__foot">
        <span className="atlas__window-label">{windowLabel}</span>
        {offFrontier && (
          <button type="button" className="atlas__recenter" onClick={() => setCenter(null)}>
            ← Wróć do siebie
          </button>
        )}
      </div>

      <Minimap
        packs={packs}
        memory={memory}
        from={layout?.from ?? 0}
        to={layout?.to ?? 0}
        onSeek={setCenter}
      />
    </section>
  )
}
