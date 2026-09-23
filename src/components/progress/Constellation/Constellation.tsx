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
import type { ColorBy, StarPalette, StarRenderer } from './renderer'
import {
  buildStarfield,
  hitTest,
  STAGE_DUE,
  STAGE_KNOWN,
  STAGE_LEARNING,
  STAGE_PERMANENT,
  STATE_RETIRED,
  wordIdAt,
} from './starfield'
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
 *
 * The component itself ships with Postęp; only its engine is fetched on
 * demand — see `loadRenderer` below.
 */

/**
 * The sky's engine, on its own schedule.
 *
 * `renderer.ts` reaches ogl, which is ~45 kB of this panel's ~63 kB, and not
 * one byte of the card around it needs any of that. So the split is HERE,
 * rather than around the whole component in StatsPage — and that is what keeps
 * the panel from arriving late and shoving the page around.
 *
 * It used to be lazy one level up, with a 460 px skeleton holding its place.
 * The real panel is 450–602 px depending on the viewport (the sky is
 * `aspect-ratio: 6/5` capped at 42vh, and the key wraps to one, two or three
 * rows), so on every phone but a 390 px one the swap moved everything below it
 * by 10–35 px — and by 140 px on a tablet. Measured, at seven widths.
 *
 * Now the card, its controls, the key and the count render at their real height
 * with the rest of the page, and the stars light up inside a box that was
 * already exactly the right size. Nothing moves; the sky simply fills in.
 */
const loadRenderer = () => import('./renderer')

interface Props {
  packs: PackMeta[]
  wordProgress: WordProgress[]
  /**
   * Whether the sky may light itself yet. The card always renders — it costs
   * about a millisecond and a half to build 11 000 star positions, measured —
   * but lighting them is ~70 ms of colour pass, buffer upload and first draw,
   * and Postęp's hero is rolling four figures on this same thread for the first
   * 900 ms. So the page can hand the panel its place immediately and still say
   * "not yet" to the expensive half. Defaults to true: nobody else has a beat
   * to protect. See useBelowHeroReady in StatsPage.tsx.
   */
  skyReady?: boolean
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

/**
 * The second colour mode, in ladder order — one hue per *situation* a word can
 * be in, not per difficulty tier.
 *
 * It earns its place next to the brightness axis because none of this is
 * derivable from stability: "do powtórki" is the day's actual work, and a
 * strong word and a weak word can both be waiting for it.
 */
const STAGE_KEYS: {
  stage: number
  name: string
  color: string
  fallback: [number, number, number]
}[] = [
  { stage: STAGE_LEARNING, name: 'w nauce', color: 'var(--accent-orange)', fallback: [237, 140, 66] },
  { stage: STAGE_DUE, name: 'do powtórki', color: 'var(--accent-pink)', fallback: [240, 110, 130] },
  { stage: STAGE_KNOWN, name: 'w pamięci', color: 'var(--accent-blue)', fallback: [120, 140, 237] },
  // "na stałe" — the app's own word for emerytura, and the same one the detail
  // panel prints for a retired word.
  { stage: STAGE_PERMANENT, name: 'na stałe', color: 'var(--accent-green)', fallback: [140, 217, 140] },
]

/** Resolves a list of CSS colours ("var(--accent-yellow)") to the 0-1 RGB the
 *  renderer wants, so the sky stays in step with the token palette by
 *  construction rather than by a copied hex. */
function readPalette(colors: string[], fallbacks: [number, number, number][]): StarPalette {
  return colors.map((raw, i) => {
    const token = tokenNameOf(raw)
    const rgb = token ? resolveToken(token, fallbacks[i]) : resolveCssColor(raw, fallbacks[i])
    return rgbUnit(rgb)
  })
}

function readColors(colorBy: ColorBy): StarPalette {
  return colorBy === 'stage'
    ? readPalette(STAGE_KEYS.map(s => s.color), STAGE_KEYS.map(s => s.fallback))
    : readPalette(([1, 2, 3, 4] as const).map(l => LEVEL_COLORS[l] ?? ''), LEVEL_FALLBACKS)
}

/** The panel's own night-sky ground, as the shader wants it (0-1). */
function readGround(el: Element): [number, number, number] {
  const raw = getComputedStyle(el).getPropertyValue('--constellation-ground').trim()
  return rgbUnit(resolveCssColor(raw, [5, 6, 12]))
}

export function Constellation({ packs, wordProgress, skyReady = true }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<StarRenderer | null>(null)
  const viewRef = useRef({ cx: 0, cy: 0, zoom: 1 })
  const [zoomLabel, setZoomLabel] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const [word, setWord] = useState<{ english: string; polish: string } | null>(null)
  const [expanded, setExpanded] = useState(false)
  // What the hue means. Brightness always means memory; this picks the other
  // axis — the pack's level, or where the word stands in the review cycle.
  const [colorBy, setColorBy] = useState<ColorBy>('level')
  // A canvas that has held a WebGL context can never hand out a 2D one, so a
  // lost context has to remount the element before the fallback can draw.
  const [glLost, setGlLost] = useState(false)
  // The engine's chunk never arrived — see loadRenderer.
  const [skyFailed, setSkyFailed] = useState(false)
  // Has the canvas drawn anything yet? Only ever set, never unset: a renderer
  // rebuilt in place (a mode this panel reaches on a lost context) already has
  // a sky on screen, and the haze should not come back over it.
  const [lit, setLit] = useState(false)

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

  // Read through a ref: switching mode must not tear down the WebGL context and
  // replay the ignition sweep — it is one attribute buffer rewrite (see the
  // colours effect below), and the sky should simply change colour under you.
  const colorByRef = useRef(colorBy)
  colorByRef.current = colorBy

  // The download starts with the card, even while `skyReady` is still holding
  // the sky back: fetching is not main-thread work, so there is nothing for the
  // hero's beat to protect from it. By the time the beat passes, the module is
  // usually already in memory and the stars come up on the next frame instead
  // of a round trip later.
  useEffect(() => {
    loadRenderer().catch(() => {})
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !skyReady) return

    // The engine arrives a tick (or a network) later than the card, so
    // everything below is written to survive an unmount in between: the flag
    // is checked once the module lands, and the cleanup disposes whatever
    // exists by then.
    let cancelled = false
    let renderer: StarRenderer | null = null
    let ro: ResizeObserver | null = null

    loadRenderer()
      .then(({ createStarRenderer }) => {
        if (cancelled) return
        renderer = createStarRenderer(canvas, {
          field,
          palette: readColors(colorByRef.current),
          colorBy: colorByRef.current,
          ground: readGround(canvas),
          reducedMotion: reduced,
          forceCanvas2d: glLost,
          onContextLost: () => setGlLost(true),
        })
        rendererRef.current = renderer
        // Surfaced for debugging on real devices — which path actually ran is
        // the first question when the sky looks wrong on someone's phone.
        canvas.dataset.backend = renderer.backend
        renderer.resize()
        const v = viewRef.current
        renderer.setView(v.cx, v.cy, v.zoom)
        renderer.setActive(engagedRef.current)

        ro = new ResizeObserver(() => {
          renderer?.resize()
          const cur = viewRef.current
          renderer?.setView(cur.cx, cur.cy, cur.zoom)
        })
        ro.observe(canvas)

        // One frame later the canvas has cleared to its ground and the sweep
        // has begun, so the waiting haze has something to lift off.
        requestAnimationFrame(() => {
          if (!cancelled) setLit(true)
        })
      })
      // Offline with a cold cache, or a chunk that 404s after a deploy. The
      // card keeps its shape and says so, rather than leaving a black square
      // that looks like a sky with nothing in it.
      .catch(() => {
        if (!cancelled) setSkyFailed(true)
      })

    return () => {
      cancelled = true
      ro?.disconnect()
      renderer?.dispose()
      rendererRef.current = null
    }
  }, [field, reduced, glLost, skyReady])

  // Runs on a mode switch, and on a theme flip: the accents are
  // theme-independent today, but re-reading costs one pass over the colour
  // attribute and means this doesn't quietly go stale the day someone gives the
  // light palette its own accents.
  useEffect(() => {
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    if (!canvas || !renderer) return
    renderer.setColors(readColors(colorBy), readGround(canvas), colorBy)
  }, [theme, colorBy])

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

  // One pass over the stage attribute, and it makes the key do double duty: in
  // "Etapy" the swatches are also the breakdown, so "ile mam dziś do powtórki"
  // is answered on the map itself rather than only in the review card above.
  const stageCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (let i = 0; i < field.count; i++) {
      const s = field.stage[i]
      if (s > 0) counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    return counts
  }, [field])

  const empty = field.litCount === 0

  return (
    <section
      ref={sectionRef}
      className={`constellation u-liquid${expanded ? ' constellation--expanded' : ''}`}
    >
      <header className="constellation__head">
        {/* Says what the colour means in the mode that is on, and stops there.
            "Im jaśniejsza, tym lepiej je pamiętasz" went the same way as the
            brightness row in the legend below, and for the same reason: you
            cannot see it at this density. */}
        <p className="constellation__sub">
          Jedna gwiazda — jedno słowo. Kolor pokazuje{' '}
          {colorBy === 'stage' ? 'etap nauki' : 'poziom słowa'}.
        </p>
        <button
          type="button"
          className="constellation__expand"
          onClick={toggleExpanded}
        >
          {expanded ? 'Zamknij' : 'Powiększ'}
        </button>
      </header>

      {/* Two ways to read the same sky. The positions never move — only the
          hue — so switching reads as the same 10 000 words seen in a different
          light, not as a different chart. */}
      <div
        className="constellation__modes"
        role="group"
        aria-label="Co oznacza kolor gwiazd"
      >
        {([
          ['level', 'Poziomy'],
          ['stage', 'Etapy'],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={`constellation__mode${colorBy === mode ? ' is-active' : ''}`}
            aria-pressed={colorBy === mode}
            onClick={() => setColorBy(mode)}
          >
            {label}
          </button>
        ))}
      </div>

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

        {/* The sky before its stars — see .constellation__waiting in the CSS.
            Not drawn over an empty route or a failed load: both of those say
            their own thing, and a haze promising a sky would argue with them. */}
        {!empty && !skyFailed && (
          <span
            className={`constellation__waiting${lit ? ' is-lit' : ''}`}
            aria-hidden="true"
          >
            <span className="constellation__waiting-glow" />
          </span>
        )}

        {skyFailed ? (
          <p className="constellation__empty">
            Nie udało się wczytać mapy gwiazd.
            <br />
            Odśwież stronę, żeby spróbować jeszcze raz.
          </p>
        ) : empty ? (
          <p className="constellation__empty">
            Na razie ciemno.
            <br />
            Pierwsze poznane słowo zapali pierwszą gwiazdę.
          </p>
        ) : null}

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
                {/* FSRS stability, named for what it is. The one place the
                    number is actually legible — the sky itself cannot show it,
                    which is why the legend no longer claims it does. */}
                <dt>Trwałość</dt>
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

      {/* The key names the HUE axis and nothing else, and that is deliberate.
          It used to carry two more rows — a brightness ramp ("Jasność = pamięć",
          świeżo poznane → na stałe) and a line about lapsed words twinkling.
          Both were dropped because neither survives the screen: at ~11 000
          points on a 390 px phone the stars sit ~3 px apart, and a sky with a
          full 1–400 day spread of stability is all but indistinguishable from
          one where every word sits at the bulk-declared 15 days. Measured, not
          guessed — a harness rendered both through this renderer at phone size.

          A legend that names an axis you cannot see is worse than no legend: it
          sends people hunting for a difference that isn't there. The channels
          themselves stay (they do real work up close, at zoom, and the
          diffraction cross on a retired word is legible) — only the promises
          about them are gone. If brightness is ever given the contrast to carry
          a claim, the row comes back with it. */}
      <div className="constellation__legend">
        <div className="constellation__legend-row">
          <span className="constellation__legend-axis">
            {colorBy === 'stage' ? 'Kolor = etap nauki' : 'Kolor = poziom'}
          </span>
          {colorBy === 'stage'
            ? STAGE_KEYS.map(s => (
                <span
                  key={s.stage}
                  className="constellation__key"
                  style={{ ['--key' as string]: s.color }}
                >
                  {s.name}
                  <b className="constellation__key-count">
                    {(stageCounts.get(s.stage) ?? 0).toLocaleString('pl-PL')}
                  </b>
                </span>
              ))
            : LEVEL_META.map(l => (
                <span
                  key={l.level}
                  className="constellation__key"
                  style={{ ['--key' as string]: LEVEL_COLORS[l.level] }}
                >
                  {l.name}
                </span>
              ))}
          {/* Only while there is dust left to explain: once the whole route is
              lit, a key for stars that aren't on screen is noise. */}
          {field.litCount < field.count && (
            <span className="constellation__key constellation__key--dust">jeszcze przed Tobą</span>
          )}
        </div>

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
