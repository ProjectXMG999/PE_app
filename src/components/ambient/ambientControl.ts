/**
 * Freeze and thaw the live ambient mesh from outside React.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 * `#root` isolates, so the ambient canvas at z-index -1 is the backdrop every
 * glass surface samples through `backdrop-filter`. A blur whose backdrop
 * changes cannot be cached, so while the shader draws — which is every frame,
 * forever — a dozen large-kernel blurs are re-convolved with it.
 *
 * That is the app's resting cost and it stays (the background is meant to be
 * alive). What it must not do is ride along through a view transition, which
 * is the one moment the compositor has no headroom to spare: the outgoing
 * capture has to paint the live canvas and every blur above it first, and then
 * the 260 ms root animation runs on top. Measured on a phone-class CPU, a
 * Dzisiaj → Pakiety hop blocked 778 ms of its first 1.5 s; removing the view
 * transition entirely accounted for ~250 ms of that.
 *
 * ── How ─────────────────────────────────────────────────────────────────────
 * Paper Shaders' `ShaderMount.setSpeed(0)` cancels its rAF and leaves
 * `currentFrame` where it stands; `setSpeed(MESH_SPEED)` resumes from exactly
 * that frame. So freezing is invisible — the mesh does not jump, reset, or
 * rebuild — and it costs no React commit, which matters: a commit between
 * `startViewTransition` and its capture is a race we would lose.
 *
 * The React wrapper re-applies `speed` only when the prop changes
 * (`useEffect(…, [speed, isInitialized])`), and nothing changes it, so a
 * re-render — a theme flip, say — will not clobber a freeze in flight.
 *
 * Reference counted: rapid tapping overlaps transitions, and the second tap's
 * freeze must not be undone by the first one's thaw.
 */

/** The live mesh's animation speed — the value `MeshField` passes and the one
 *  a thaw restores. One home, so the two can't drift. */
export const MESH_SPEED = 0.14

interface ShaderMount {
  setSpeed: (speed: number) => void
}

interface ShaderHost extends HTMLElement {
  paperShaderMount?: ShaderMount
}

/**
 * The animated mesh, or undefined.
 *
 * `[data-ambient-live]` is set by AmbientBackground only while the ANIMATED
 * shader is the one mounted. Without that guard this would also find
 * `StaticMeshGradient` — the still variant used under reduced motion and in a
 * hidden tab — and a thaw would set a background that is meant to hold still
 * animating at full speed.
 */
function liveMesh(): ShaderMount | undefined {
  return document.querySelector<ShaderHost>(
    '.ambient__field[data-ambient-live] [data-paper-shader]',
  )?.paperShaderMount
}

let frozen = 0

/** Stop the mesh where it stands. Pairs with exactly one `thawAmbient`. */
export function freezeAmbient(): void {
  if (frozen++ === 0) liveMesh()?.setSpeed(0)
}

/**
 * Resume from the frozen frame, once every freeze has been released.
 *
 * Callers pair every freeze with a thaw on a timer as well as on completion,
 * because a background stuck still is a far worse bug than a transition that
 * paid full price. The floor at zero is what makes that double release safe.
 */
export function thawAmbient(): void {
  if (frozen === 0) return
  if (--frozen === 0) liveMesh()?.setSpeed(MESH_SPEED)
}

// ── The mesh stops when nobody is there ──────────────────────────────────────

/**
 * How long after the last touch the mesh holds still.
 *
 * Long enough that it is still visibly alive when you arrive on a screen and
 * when you put your finger down, short enough that the resting state of the app
 * — someone reading a card — is the still one.
 */
const IDLE_MS = 2000

/**
 * Hold the mesh still while nobody is touching the phone.
 *
 * The drift is the app's resting cost, and it is not the canvas that makes it
 * expensive: `#root` isolates, so this canvas is the backdrop every glass
 * surface samples, and a backdrop that changes cannot have its blur cached. A
 * dozen large-kernel blurs are therefore re-convolved on every frame the shader
 * draws — which, until now, was every frame, forever, including while the
 * screen sat completely still. Stopping the shader makes all of them cacheable
 * at once, so the saving is a multiple of the shader's own cost, and it leaves
 * the GPU with headroom at the moment that actually needs it: the next tap.
 *
 * Coarse pointers only. A desktop GPU filling a small canvas is not the axis
 * this is about, and the drift is more visible on a large screen.
 *
 * Takes ONE reference on the shared counter above and never more, so it can
 * never fight with the freeze a navigation takes: whichever asks first stops
 * the mesh, and it resumes only once both have let go.
 */
let idleTimer = 0
let idleHolding = false

function holdIdle(): void {
  if (idleHolding) return
  idleHolding = true
  freezeAmbient()
}

function releaseIdle(): void {
  if (!idleHolding) return
  idleHolding = false
  thawAmbient()
}

/** Any sign of life: let the mesh run, and start the clock again. */
function bumpIdle(): void {
  releaseIdle()
  window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(holdIdle, IDLE_MS)
}

/**
 * Start watching for stillness. Returns the teardown, so the caller can tie
 * this to the lifetime of the mounted shader — which is also why it is safe to
 * assume the mesh exists by the time the first timer fires.
 */
export function startIdleFreeze(): () => void {
  if (!window.matchMedia?.('(pointer: coarse)').matches) return () => {}

  // Capture, so a scroll inside any container counts — scroll events from a
  // scrolling element do not bubble to the window, and `.appshell__main` is
  // where all of this app's scrolling happens.
  const opts = { passive: true, capture: true } as const
  window.addEventListener('pointerdown', bumpIdle, opts)
  window.addEventListener('scroll', bumpIdle, opts)
  bumpIdle()

  return () => {
    window.removeEventListener('pointerdown', bumpIdle, opts)
    window.removeEventListener('scroll', bumpIdle, opts)
    window.clearTimeout(idleTimer)
    releaseIdle()
  }
}
