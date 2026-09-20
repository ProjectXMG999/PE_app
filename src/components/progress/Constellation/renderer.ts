import { Geometry, Mesh, Program, Renderer } from 'ogl'
import { STATE_DUST, STATE_LEARNING, STATE_RETIRED, Starfield } from './starfield'

/**
 * Draws a Starfield. Two implementations behind one interface:
 *
 *  - WebGL (ogl, ~12 kB): all ~11 000 stars in a single POINTS draw call, with
 *    additive blending so overlapping glow accumulates the way light does.
 *  - Canvas 2D: the same picture built from one pre-rendered glow sprite per
 *    level. Used when WebGL is unavailable, and under prefers-reduced-motion
 *    where a single still frame is all we want anyway.
 *
 * Both are DOM- and React-free on purpose: they take a canvas and numbers.
 * Reading CSS custom properties is the component's job (see Constellation.tsx),
 * so this module never has to know what a theme is.
 */

/** RGB 0..1 per level, index 0 = level 1. */
export type LevelColors = [number, number, number][]

export interface RendererOpts {
  field: Starfield
  levelColors: LevelColors
  /** Background the stars sit on, RGB 0..1. */
  ground: [number, number, number]
  /** Skip the intro sweep and all idle motion. */
  reducedMotion: boolean
  /** Seconds the intro ignition sweep takes. */
  introSec?: number
  /** Skip WebGL entirely and draw with canvas 2D. */
  forceCanvas2d?: boolean
  /** The GPU dropped the context (backgrounded tab, driver reset, low memory).
   *  The canvas can't be reused, so the caller should remount it and come back
   *  with forceCanvas2d. */
  onContextLost?: () => void
}

export interface StarRenderer {
  readonly backend: 'webgl' | 'canvas'
  /** Re-reads the canvas's CSS size. Call on resize / orientation change. */
  resize(): void
  /** Stops/starts the animation loop. A star field animating behind a screenful
   *  of other content is pure battery burn, so the panel parks it when it
   *  scrolls out of view. */
  setActive(active: boolean): void
  /** World-space centre and zoom factor. */
  setView(centerX: number, centerY: number, zoom: number): void
  setColors(levelColors: LevelColors, ground: [number, number, number]): void
  /** Restart the ignition sweep from the beginning. */
  replayIntro(): void
  dispose(): void
}

const DPR_CAP = 2

/* Stars are lit by how well the word is remembered, and hot stars in the sky
   run white — so brightness pulls the level's hue toward white rather than just
   raising its alpha. Keeps a mastered word from looking like a louder version
   of a half-learned one. */
function starColors(field: Starfield, levels: LevelColors): Float32Array {
  const out = new Float32Array(field.count * 3)
  for (let i = 0; i < field.count; i++) {
    const c = levels[Math.round(field.level[i]) - 1] ?? levels[0]
    const lit = field.state[i] !== STATE_DUST
    // 0.35, not 0.55. Brightness is already carried twice over — by alpha and
    // by point size — so washing the hue out on top of that was redundant
    // reinforcement that cost the one thing hue is for. At 0.55 the level-1
    // core came out cream rather than yellow, which made the legend's promise
    // ("kolor = poziom") false exactly where memory is strongest.
    const mixToWhite = lit ? 0.35 * field.brightness[i] : 0
    out[i * 3] = c[0] + (1 - c[0]) * mixToWhite
    out[i * 3 + 1] = c[1] + (1 - c[1]) * mixToWhite
    out[i * 3 + 2] = c[2] + (1 - c[2]) * mixToWhite
  }
  return out
}

const VERTEX = /* glsl */ `
  attribute vec2 position;
  attribute vec3 aColor;
  attribute float aBright;
  attribute float aState;
  attribute float aIgnite;
  attribute float aSeed;
  attribute float aFlicker;

  uniform vec2 uResolution;
  uniform vec2 uCenter;
  uniform float uZoom;
  uniform float uMinAxis;
  /** Mean distance between neighbouring stars, in device pixels, at the current
   *  zoom. Star size is expressed in these units so the sky stays a field of
   *  separate points instead of collapsing into one lit blob. */
  uniform float uSpacing;
  uniform float uDpr;
  uniform float uTime;
  uniform float uProgress;
  uniform float uStill;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vCross;

  void main() {
    vec2 p = (position - uCenter) * uZoom;
    // Divide by the viewport, not by clip space, so the disc stays a disc on
    // any aspect ratio instead of stretching with the window.
    gl_Position = vec4(p * vec2(uMinAxis / uResolution.x, uMinAxis / uResolution.y), 0.0, 1.0);

    float lit = step(0.5, aState);

    // Ignition sweep: each star waits for the front to reach it, then flares
    // briefly before settling. Dust carries aIgnite < 0 and is simply always on.
    float t = aIgnite < 0.0 ? 1.0 : clamp((uProgress - aIgnite) * 7.0, 0.0, 1.0);
    float flare = lit * smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(0.25, 1.0, t));

    float phase = aSeed * 6.2831853;
    float twinkle = 1.0 + (1.0 - uStill) * aFlicker * 0.45 * sin(uTime * 2.7 + phase);
    // Words still being learned breathe slowly — visibly unsettled, not broken.
    float learning = step(abs(aState - ${STATE_LEARNING}.0), 0.25);
    twinkle *= 1.0 + (1.0 - uStill) * learning * 0.3 * sin(uTime * 1.3 + phase);

    float size = mix(0.62, 0.75 + 1.25 * aBright, lit) * uSpacing;
    gl_PointSize = clamp(size * (1.0 + 1.8 * flare), uDpr, 96.0);

    vColor = aColor;
    // Dust has to stay legible: it is the rest of the route, and a learner
    // seeing only their own lit core would lose the scale the panel is for.
    vAlpha = mix(0.17, (0.18 + 0.62 * aBright) * t * twinkle, lit);
    // Retired words — the ones held for a year — get the diffraction spike a
    // camera gives the brightest stars in the frame.
    vCross = step(abs(aState - ${STATE_RETIRED}.0), 0.25) * t;
  }
`

const FRAGMENT = /* glsl */ `
  precision mediump float;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vCross;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    // Cubed falloff: a tight core with a short halo, so neighbouring stars stay
    // countable instead of bleeding into a single lit disc.
    float halo = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.13, 0.0, d);
    float spike = vCross
      * (smoothstep(0.06, 0.0, abs(uv.x)) + smoothstep(0.06, 0.0, abs(uv.y)))
      * smoothstep(0.5, 0.05, d);
    float a = (halo * halo * halo * 0.55 + core * 0.9 + spike * 0.3) * vAlpha;
    if (a < 0.004) discard;
    // Premultiplied, drawn with additive blending onto an opaque ground.
    gl_FragColor = vec4(vColor * a, a);
  }
`

function createWebglRenderer(canvas: HTMLCanvasElement, opts: RendererOpts): StarRenderer | null {
  const { field } = opts
  let renderer: Renderer
  try {
    renderer = new Renderer({
      canvas,
      dpr: Math.min(DPR_CAP, window.devicePixelRatio || 1),
      alpha: false,
      antialias: false,
      depth: false,
      // No preserveDrawingBuffer: it forces a second full-size buffer, and the
      // animated path repaints every frame anyway. The still (reduced-motion)
      // path doesn't come through here at all — it uses canvas 2D.
    })
  } catch (err) {
    console.warn('[constellation] WebGL unavailable — using canvas 2D', err)
    return null
  }

  const gl = renderer.gl
  const geometry = new Geometry(gl, {
    position: { size: 2, data: field.position },
    aColor: { size: 3, data: starColors(field, opts.levelColors) },
    aBright: { size: 1, data: field.brightness },
    aState: { size: 1, data: field.state },
    aIgnite: { size: 1, data: field.ignite },
    aSeed: { size: 1, data: field.seed },
    aFlicker: { size: 1, data: field.flicker },
  })

  const program = new Program(gl, {
    vertex: VERTEX,
    fragment: FRAGMENT,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    uniforms: {
      uResolution: { value: [1, 1] },
      uCenter: { value: [0, 0] },
      uZoom: { value: 1 },
      uMinAxis: { value: 1 },
      uSpacing: { value: 4 },
      uDpr: { value: Math.min(DPR_CAP, window.devicePixelRatio || 1) },
      uTime: { value: 0 },
      uProgress: { value: opts.reducedMotion ? 1 : 0 },
      uStill: { value: opts.reducedMotion ? 1 : 0 },
    },
  })
  program.setBlendFunc(gl.ONE, gl.ONE)

  const mesh = new Mesh(gl, { mode: gl.POINTS, geometry, program })

  let ground = opts.ground
  const introSec = opts.introSec ?? 2.5
  let startedAt = performance.now()
  let raf = 0
  let disposed = false

  function onLost(e: Event) {
    // Without preventDefault the context can never be restored, and either way
    // this renderer is finished — hand the caller a chance to fall back.
    e.preventDefault()
    disposed = true
    cancelAnimationFrame(raf)
    console.warn('[constellation] WebGL context lost — falling back to canvas 2D')
    opts.onContextLost?.()
  }
  canvas.addEventListener('webglcontextlost', onLost)

  function resize() {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h)
    // setSize also writes inline style.width/height in CSS pixels, which
    // overrides the stylesheet's width:100%/height:100% and then feeds the next
    // clientWidth read — the canvas latches onto its own 300×150 default and
    // never grows. Drop the inline sizes and leave layout to the CSS.
    canvas.style.width = ''
    canvas.style.height = ''
    program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height]
    program.uniforms.uMinAxis.value = Math.min(gl.canvas.width, gl.canvas.height)
    updateSpacing()
  }

  /* The disc spans the shorter axis, and `count` stars sit on it at roughly
     even density — so the gap between neighbours is the disc's width over the
     square root of the count. */
  function updateSpacing() {
    const minAxis = Math.min(gl.canvas.width, gl.canvas.height)
    program.uniforms.uSpacing.value =
      (minAxis * program.uniforms.uZoom.value) / Math.sqrt(field.count)
  }

  let active = true
  let pausedAt = 0

  function frame(now: number) {
    if (disposed || !active) return
    const elapsed = (now - startedAt) / 1000
    program.uniforms.uTime.value = elapsed
    if (!opts.reducedMotion) {
      program.uniforms.uProgress.value = Math.min(1, elapsed / introSec)
    }
    gl.clearColor(ground[0], ground[1], ground[2], 1)
    renderer.render({ scene: mesh })

    // Under reduced motion nothing moves after the first frame, so stop drawing
    // it — a static picture has no business holding a rAF loop on a phone.
    if (opts.reducedMotion) return
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    backend: 'webgl',
    resize,
    setActive(next) {
      if (disposed || next === active) return
      active = next
      if (!next) {
        cancelAnimationFrame(raf)
        pausedAt = performance.now()
        return
      }
      // Shift the clock by however long we were parked, so a panel that was
      // scrolled past mid-ignition resumes the sweep instead of finding it
      // already over.
      if (pausedAt) startedAt += performance.now() - pausedAt
      pausedAt = 0
      raf = requestAnimationFrame(frame)
    },
    setView(cx, cy, zoom) {
      program.uniforms.uCenter.value = [cx, cy]
      program.uniforms.uZoom.value = zoom
      updateSpacing()
      if (opts.reducedMotion && !disposed) raf = requestAnimationFrame(frame)
    },
    setColors(levelColors, nextGround) {
      ground = nextGround
      geometry.attributes.aColor.data = starColors(field, levelColors)
      geometry.attributes.aColor.needsUpdate = true
      if (opts.reducedMotion && !disposed) raf = requestAnimationFrame(frame)
    },
    replayIntro() {
      if (opts.reducedMotion) return
      startedAt = performance.now()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      canvas.removeEventListener('webglcontextlost', onLost)
      geometry.remove()
      program.remove()
      // Deliberately NOT WEBGL_lose_context.loseContext(): a canvas whose
      // context has been force-lost never hands out a working one again, and
      // under StrictMode this effect mounts, disposes and mounts again on the
      // same element — which killed the context before the real render ever ran.
      // Dropping the buffers above is enough; the context goes with the element.
    },
  }
}

/** One pre-rendered radial glow per level, tinted and reused for every star. */
function glowSprite(rgb: [number, number, number], size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const r = size / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  const [cr, cg, cb] = rgb.map(v => Math.round(v * 255))
  // Tight core, short halo — the 2D twin of the shader's cubed falloff.
  g.addColorStop(0, `rgba(255,255,255,1)`)
  g.addColorStop(0.16, `rgba(${cr},${cg},${cb},0.62)`)
  g.addColorStop(0.45, `rgba(${cr},${cg},${cb},0.1)`)
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

function createCanvasRenderer(canvas: HTMLCanvasElement, opts: RendererOpts): StarRenderer {
  const { field } = opts
  const ctx = canvas.getContext('2d')!
  const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1)

  let sprites = opts.levelColors.map(c => glowSprite(c, 32))
  let ground = opts.ground
  let center: [number, number] = [0, 0]
  let zoom = 1
  let w = 1
  let h = 1
  let raf = 0
  let disposed = false
  let active = true
  let pausedAt = 0
  let startedAt = performance.now()
  const introSec = opts.introSec ?? 2.5

  function resize() {
    w = canvas.clientWidth || 1
    h = canvas.clientHeight || 1
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    draw()
  }

  function draw() {
    if (disposed || !active) return
    const progress = opts.reducedMotion ? 1 : Math.min(1, (performance.now() - startedAt) / 1000 / introSec)
    const minAxis = Math.min(canvas.width, canvas.height)
    const [gr, gg, gb] = ground.map(v => Math.round(v * 255))
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgb(${gr},${gg},${gb})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const scale = (minAxis / 2) * zoom
    // Same reasoning as the shader's uSpacing: size stars by how far apart they
    // actually are, or 11 000 glows merge into one disc.
    const spacing = (minAxis * zoom) / Math.sqrt(field.count)

    // Dust first, flat and cheap — thousands of 1px marks, no compositing.
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = 'rgba(190,200,255,0.17)'
    for (let i = 0; i < field.count; i++) {
      if (field.state[i] !== STATE_DUST) continue
      const x = cx + (field.position[i * 2] - center[0]) * scale
      const y = cy + (field.position[i * 2 + 1] - center[1]) * scale
      if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) continue
      ctx.fillRect(x, y, dpr, dpr)
    }

    for (let i = 0; i < field.count; i++) {
      if (field.state[i] === STATE_DUST) continue
      if (field.ignite[i] > progress) continue
      const x = cx + (field.position[i * 2] - center[0]) * scale
      const y = cy + (field.position[i * 2 + 1] - center[1]) * scale
      // Same size and alpha curves as the shader's, so the fallback reads as
      // the same sky rather than a saturated colour wheel — 'lighter' with no
      // cubed falloff piles up fast, hence the slightly lower alpha.
      const size = Math.max(dpr, spacing * (0.75 + 1.25 * field.brightness[i]))
      if (x + size < 0 || y + size < 0 || x - size > canvas.width || y - size > canvas.height) continue
      const sprite = sprites[Math.round(field.level[i]) - 1] ?? sprites[0]
      ctx.globalAlpha = 0.14 + 0.46 * field.brightness[i]
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size)
    }
    ctx.globalAlpha = 1

    if (opts.reducedMotion || progress >= 1) return
    raf = requestAnimationFrame(draw)
  }
  raf = requestAnimationFrame(draw)

  return {
    backend: 'canvas',
    resize,
    setActive(next) {
      if (disposed || next === active) return
      active = next
      if (!next) {
        cancelAnimationFrame(raf)
        pausedAt = performance.now()
        return
      }
      if (pausedAt) startedAt += performance.now() - pausedAt
      pausedAt = 0
      draw()
    },
    setView(nx, ny, nz) {
      center = [nx, ny]
      zoom = nz
      draw()
    },
    setColors(levelColors, nextGround) {
      sprites = levelColors.map(c => glowSprite(c, 32))
      ground = nextGround
      draw()
    },
    replayIntro() {
      if (opts.reducedMotion) return
      startedAt = performance.now()
      draw()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
    },
  }
}

export function createStarRenderer(canvas: HTMLCanvasElement, opts: RendererOpts): StarRenderer {
  // Reduced motion gets the 2D path deliberately: it draws one still frame and
  // then stops, with no GL context held open for a picture that never changes.
  if (!opts.reducedMotion && !opts.forceCanvas2d) {
    const gl = createWebglRenderer(canvas, opts)
    if (gl) return gl
  }
  return createCanvasRenderer(canvas, opts)
}
