import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { LEVEL_COLORS, LEVEL_META } from '../../../data/levels'
import { resolveCssColor, resolveToken, rgbUnit, tokenNameOf } from '../../../utils/cssColor'
import { fetchPack } from '../../../hooks/usePackageData'
import { useAppStore } from '../../../store/useAppStore'
import { WordProgress } from '../../../types/progress'
import { PackMeta } from '../../../types/vocabulary'
import { dayKey, daysBetween } from '../../../utils/day'
import { plDays, plTimes, plWords } from '../../../utils/plural'
import { createStarRenderer, LevelColors, StarRenderer } from './renderer'
import { buildStarfield, hitTest, STATE_RETIRED, wordIdAt } from './starfield'
import './Constellation.css'

/**
 * The Constellation: one star for every word on the 10 000-word route, lit by
 * how well you remember it.
 *
 * Every other view on Postęp measures *activity* — the heatmap says you
 * practised on Wednesday, the route map says how far you walked. This one shows
 * *memory*: the app has been computing an FSRS stability per word for months and
 * nothing has ever rendered it word by word.
 *
 * The sky stays a night sky in both themes. Stars are additive light, and
 * additive light on a white page is grey smudge — so the panel keeps its own
 * dark ground while the level hues still come from the shared accent tokens.
 */

interface Props {
  packs: PackMeta[]
  wordProgress: WordProgress[]
}

const MIN_ZOOM = 1
const MAX_ZOOM = 14
/** Comfortable touch target for picking a star, in CSS pixels. */
const TAP_RADIUS_PX = 22

const LEVEL_FALLBACKS: [number, number, number][] = [
  [242, 194, 69],
  [237, 140, 66],
  [140, 217, 140],
  [120, 140, 237],
]

/** Pulls the four level accents out of LEVEL_COLORS ("var(--accent-yellow)")
 *  and resolves them, so this stays in step with levels.ts by construction. */
function readLevelColors(): LevelColors {
  return ([1, 2, 3, 4] as const).map((lvl, i) => {
    const token = tokenNameOf(LEVEL_COLORS[lvl] ?? '')
    const rgb = token
      ? resolveToken(token, LEVEL_FALLBACKS[i])
      : resolveCssColor(LEVEL_COLORS[lvl] ?? '', LEVEL_FALLBACKS[i])
    return rgbUnit(rgb)
  }) as LevelColors
}

/** The panel's own night-sky ground, as the shader wants it (0-1). */
function readGround(el: Element): [number, number, number] {
  const raw = getComputedStyle(el).getPropertyValue('--constellation-ground').trim()
  return rgbUnit(resolveCssColor(raw, [5, 6, 12]))
}

export function Constellation({ packs, wordProgress }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<StarRenderer | null>(null)
  const viewRef = useRef({ cx: 0, cy: 0, zoom: 1 })
  const [zoomLabel, setZoomLabel] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const [word, setWord] = useState<{ english: string; polish: string } | null>(null)
  const [expanded, setExpanded] = useState(false)
  // A canvas that has held a WebGL context can never hand out a 2D one, so a
  // lost context has to remount the element before the fallback can draw.
  const [glLost, setGlLost] = useState(false)

  const theme = useAppStore(s => s.theme)
  const setAmbientHidden = useAppStore(s => s.setAmbientHidden)
  const setChromeHidden = useAppStore(s => s.setChromeHidden)
  const reduced = !!useReducedMotion()

  const field = useMemo(() => buildStarfield(packs, wordProgress), [packs, wordProgress])

  // Is the sky actually on screen? Used to park its animation loop — a WebGL
  // rAF running behind a screenful of other content is pure battery burn on a
  // page as long as Postęp.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '120px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const engaged = visible || expanded
  // Mirrored into a ref so a renderer created while the panel is off screen can
  // be parked immediately, rather than animating until the next visibility
  // change happens to re-run the effect below.
  const engagedRef = useRef(engaged)
  engagedRef.current = engaged

  // The ambient shader stands down only in the expanded view, where the sky is
  // the whole screen and the gradient would be two shaders deep for nothing.
  //
  // Not while merely scrolled into view, and the reason is worth recording: the
  // first version of this hid the ambient for the panel's whole lifetime,
  // because a lost WebGL context looked like the two shaders were competing for
  // the GPU. That diagnosis was wrong — the context was being killed by an
  // explicit loseContext() in the renderer's teardown, which StrictMode's
  // double-mount then handed back to a canvas that could never recover (see
  // renderer.ts's dispose). With that fixed the two contexts coexist happily,
  // so tying this to scroll position would only make the page's background pop
  // in and out as you scrolled past.
  useEffect(() => {
    if (!expanded) return
    setAmbientHidden(true)
    setChromeHidden(true)
    return () => {
      setAmbientHidden(false)
      setChromeHidden(false)
    }
  }, [expanded, setAmbientHidden, setChromeHidden])

  useEffect(() => {
    rendererRef.current?.setActive(engaged)
  }, [engaged])

  /**
   * Ways out of full screen, beyond the one button.
   *
   * A full-screen layer that only answers a 77×40 target in a corner is a trap
   * on a phone — the back gesture is what people actually reach for, and
   * without this it would leave Postęp entirely. So opening pushes a history
   * entry and back pops it; the button closes by going back too, so the entry
   * is always consumed rather than left behind for the next swipe to eat.
   *
   * The URL is deliberately unchanged (pushState with no url), so the router
   * sees the same location and nothing re-navigates.
   */
  useEffect(() => {
    if (!expanded) return
    window.history.pushState({ constellationExpanded: true }, '')
    const onPop = () => setExpanded(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  // Read through a ref rather than the state updater: a state updater must be
  // pure, and React calls it twice under StrictMode — which would have gone
  // back two entries and thrown the user off Postęp altogether.
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded

  const toggleExpanded = useCallback(() => {
    // Closing goes through history so the entry pushed on open is consumed;
    // popstate then flips the state. Opening flips it directly.
    if (expandedRef.current) window.history.back()
    else setExpanded(true)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = createStarRenderer(canvas, {
      field,
      levelColors: readLevelColors(),
      ground: readGround(canvas),
      reducedMotion: reduced,
      forceCanvas2d: glLost,
      onContextLost: () => setGlLost(true),
    })
    rendererRef.current = renderer
    // Surfaced for debugging on real devices — which path actually ran is the
    // first question when the sky looks wrong on someone's phone.
    canvas.dataset.backend = renderer.backend
    renderer.resize()
    const v = viewRef.current
    renderer.setView(v.cx, v.cy, v.zoom)
    renderer.setActive(engagedRef.current)

    const ro = new ResizeObserver(() => {
      renderer.resize()
      const cur = viewRef.current
      renderer.setView(cur.cx, cur.cy, cur.zoom)
    })
    ro.observe(canvas)

    return () => {
      ro.disconnect()
      renderer.dispose()
      rendererRef.current = null
    }
  }, [field, reduced, glLost])

  // Level accents are theme-independent today, but re-reading on a theme flip
  // costs one pass over the colour attribute and means this doesn't quietly go
  // stale the day someone gives the light palette its own accents.
  useEffect(() => {
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    if (!canvas || !renderer) return
    renderer.setColors(readLevelColors(), readGround(canvas))
  }, [theme])

  const applyView = useCallback((cx: number, cy: number, zoom: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
    // Never let the sky be dragged off screen: at zoom 1 the disc is pinned,
    // and past that you can only pan as far as its edge.
    const limit = Math.max(0, 1 - 1 / z)
    viewRef.current = {
      cx: Math.max(-limit, Math.min(limit, cx)),
      cy: Math.max(-limit, Math.min(limit, cy)),
      zoom: z,
    }
    setZoomLabel(z)
    const v = viewRef.current
    rendererRef.current?.setView(v.cx, v.cy, v.zoom)
  }, [])

  /* ── Gestures ─────────────────────────────────────────────────────────── */

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({
    moved: 0,
    startedAt: 0,
    pinchDist: 0,
    pinchZoom: 1,
    lastTap: { at: 0, x: 0, y: 0 },
  })

  /** CSS pixels per world unit — the disc spans the shorter axis. */
  const scalePx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return 1
    return (Math.min(canvas.clientWidth, canvas.clientHeight) / 2) * viewRef.current.zoom
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      gesture.current.moved = 0
      gesture.current.startedAt = performance.now()
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current.pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      gesture.current.pinchZoom = viewRef.current.zoom
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (gesture.current.pinchDist > 0) {
        const v = viewRef.current
        applyView(v.cx, v.cy, gesture.current.pinchZoom * (dist / gesture.current.pinchDist))
      }
      gesture.current.moved += 10
      return
    }

    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    gesture.current.moved += Math.hypot(dx, dy)
    const s = scalePx()
    const v = viewRef.current
    applyView(v.cx - dx / s, v.cy - dy / s, v.zoom)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0) return
    const wasTap = gesture.current.moved < 6 && performance.now() - gesture.current.startedAt < 400
    if (!wasTap) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const s = scalePx()
    const v = viewRef.current
    const wx = v.cx + (e.clientX - rect.left - rect.width / 2) / s
    const wy = v.cy + (e.clientY - rect.top - rect.height / 2) / s

    // Double tap zooms to the point, or back out if already in. Pinch works,
    // but it needs two thumbs and this panel is most often read one-handed on a
    // phone — a double tap is the gesture people actually reach for on a map.
    const now = performance.now()
    const last = gesture.current.lastTap
    const isDouble =
      now - last.at < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 36
    gesture.current.lastTap = { at: now, x: e.clientX, y: e.clientY }

    if (isDouble) {
      setSelected(null)
      if (v.zoom > 1.6) applyView(0, 0, 1)
      else applyView(wx, wy, 4)
      return
    }

    const hit = hitTest(field, wx, wy, TAP_RADIUS_PX / s)
    setSelected(hit >= 0 ? hit : null)
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const v = viewRef.current
    applyView(v.cx, v.cy, v.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
  }

  /* ── Detail ───────────────────────────────────────────────────────────── */

  // The English word itself lives in the paywalled pack blob, so it is fetched
  // only for the one star you tapped. Failure is silent: the memory numbers
  // below are the point, and they are already in hand.
  useEffect(() => {
    if (selected == null) {
      setWord(null)
      return
    }
    let alive = true
    setWord(null)
    const pack = packs[field.packOf[selected]]
    const wordId = wordIdAt(field, packs, selected)
    if (!pack || !wordId) return
    fetchPack(pack.id)
      .then(p => {
        const w = p.words.find(x => x.id === wordId)
        if (alive && w) setWord({ english: w.english, polish: w.polish })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [selected, field, packs])

  const detail = useMemo(() => {
    if (selected == null) return null
    const wp = wordProgress[field.progressOf[selected]]
    if (!wp) return null
    const pack = packs[field.packOf[selected]]
    const sinceSeen = daysBetween(wp.lastSeen.slice(0, 10), dayKey())
    return {
      pack,
      stability: wp.stability,
      retired: field.state[selected] === STATE_RETIRED,
      lapses: wp.lapseCount ?? 0,
      sinceSeen,
    }
  }, [selected, field, wordProgress, packs])

  const empty = field.litCount === 0

  return (
    <section
      ref={sectionRef}
      className={`constellation u-liquid${expanded ? ' constellation--expanded' : ''}`}
    >
      <header className="constellation__head">
        <p className="constellation__sub">
          Jedna gwiazda — jedno słowo. Im jaśniejsza, tym lepiej je pamiętasz.
        </p>
        <button
          type="button"
          className="constellation__expand"
          onClick={toggleExpanded}
        >
          {expanded ? 'Zamknij' : 'Powiększ'}
        </button>
      </header>

      <div className={`constellation__sky${detail ? ' constellation__sky--detail' : ''}`}>
        <canvas
          key={glLost ? 'canvas2d' : 'webgl'}
          ref={canvasRef}
          className="constellation__canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          role="img"
          aria-label={
            empty
              ? 'Mapa 10 000 słów — jeszcze bez zapalonych gwiazd'
              : `Mapa 10 000 słów — ${field.litCount} ${plWords(field.litCount)} zapalonych`
          }
        />

        {empty && (
          <p className="constellation__empty">
            Na razie ciemno.
            <br />
            Pierwsze poznane słowo zapali pierwszą gwiazdę.
          </p>
        )}

        {zoomLabel > 1.02 && (
          <button
            type="button"
            className="constellation__reset"
            onClick={() => applyView(0, 0, 1)}
          >
            Wyśrodkuj
          </button>
        )}

        {detail && (
          <div className="constellation__detail" role="status">
            <button
              type="button"
              className="constellation__detail-close"
              onClick={() => setSelected(null)}
              aria-label="Zamknij szczegóły słowa"
            >
              ×
            </button>
            <p className="constellation__detail-word">{word?.english ?? '…'}</p>
            {word && <p className="constellation__detail-pl">{word.polish}</p>}
            <dl className="constellation__detail-stats">
              <div>
                <dt>Pamięć</dt>
                <dd>
                  {detail.retired
                    ? 'na stałe'
                    : detail.stability != null
                      ? `${Math.round(detail.stability)} ${plDays(Math.round(detail.stability))}`
                      : '—'}
                </dd>
              </div>
              <div>
                <dt>Ostatnia powtórka</dt>
                <dd>
                  {detail.sinceSeen <= 0
                    ? 'dziś'
                    : `${detail.sinceSeen} ${plDays(detail.sinceSeen)} temu`}
                </dd>
              </div>
              {detail.lapses > 0 && (
                <div>
                  <dt>Uciekło</dt>
                  <dd>
                    {detail.lapses} {plTimes(detail.lapses)}
                  </dd>
                </div>
              )}
            </dl>
            {detail.pack && <p className="constellation__detail-pack">{detail.pack.name}</p>}
          </div>
        )}
      </div>

      {/* The colour key, and it is a LEVEL key — see starColors() in renderer.ts:
          hue comes from the pack's level and nothing else, while brightness
          carries how well the word is remembered. The first version of this
          legend labelled the hues by learning state ("w nauce" against orange,
          "znane" against green), which read a level-2 band as a pile of words
          in progress. */}
      <div className="constellation__legend">
        <span className="constellation__legend-axis">Kolor = poziom</span>
        {LEVEL_META.map(l => (
          <span
            key={l.level}
            className="constellation__key"
            style={{ ['--key' as string]: LEVEL_COLORS[l.level] }}
          >
            {l.name}
          </span>
        ))}
        <span className="constellation__key constellation__key--dust">jeszcze przed Tobą</span>
      </div>

      <p className="constellation__foot">
        {empty ? (
          'Czeka 10 000 gwiazd — po jednej na każde słowo na trasie.'
        ) : (
          <>
            Świeci {field.litCount.toLocaleString('pl-PL')} z{' '}
            {field.count.toLocaleString('pl-PL')}.{' '}
            {/* The one affordance that isn't discoverable on a phone: there is
                no hover to reveal that a star is tappable. */}
            <span className="constellation__hint">Stuknij gwiazdę, żeby zobaczyć słowo.</span>
          </>
        )}
      </p>
    </section>
  )
}

export default Constellation
