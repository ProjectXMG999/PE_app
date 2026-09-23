import { MeshGradient, StaticMeshGradient } from '@paper-design/shaders-react'
import { MESH_SPEED } from './ambientControl'

/**
 * The WebGL half of the ambient background, split into its own module so it can
 * be code-split away from the initial bundle — @paper-design/shaders-react is
 * the heaviest dependency in the app and none of it is needed to paint the
 * first screen. AmbientBackground lazy-loads this once the browser is idle.
 *
 * Ported from the landing page (landing/src/components/ambient/MeshField.tsx),
 * parameters included: the product has to be the same atmosphere as the page
 * that sold it, not a similar one.
 *
 * `still` collapses the animated shader to a single static frame — used under
 * prefers-reduced-motion, and whenever the tab is hidden so a backgrounded PWA
 * isn't spending battery on a picture nobody is looking at.
 */
const FILL = { width: '100%', height: '100%' } as const

/**
 * How many fragments a frame of this background is allowed to cost.
 *
 * The library sizes its drawing buffer to the element's device pixels and then
 * scales down to fit this ceiling (`scaleToMeetMaxPixelCount` in
 * shader-mount.js). The element is the whole viewport, so on a 1170×2532 phone
 * the untouched target is 2.96M px and the old 2.1M ceiling barely bit: the
 * shader ran ~985×2132 ≈ 2.1M fragments, sixty times a second, forever, on
 * every screen that isn't a session. The fragment program is not trivial
 * either — a distortion loop plus a ten-colour accumulation per fragment — and
 * `speed: 0.14` slows the shader's *clock*, not the frame rate.
 *
 * Worse, it is the multiplier under everything else: #root isolates, so this
 * canvas at z-index -1 is the backdrop every `.u-liquid` surface and the tab
 * bar sample through `backdrop-filter`. A blur whose backdrop changes every
 * frame can never be cached, so a dozen 28px blurs were being re-convolved
 * continuously while the screen sat still.
 *
 * A mesh gradient is, by construction, the one thing that upscales invisibly —
 * it has no edges and no detail. So a coarse pointer gets a quarter of the
 * budget and loses nothing you can see.
 *
 * Note `minPixelRatio` is deliberately NOT set: the library computes
 * `max(1, minPixelRatio / dpr)`, which is 1 on any device with dpr >= 2. It
 * only ever upscales low-DPR displays, and is a no-op on exactly the phones
 * this is about.
 */
const COARSE_POINTER =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(pointer: coarse)').matches === true

const MAX_PIXEL_COUNT = COARSE_POINTER ? 600_000 : 2_100_000

/** A full-screen gradient quad has no edges to smooth, no depth and no stencil,
 *  and no reason to ask for the discrete GPU. All four are pure savings —
 *  `antialias: false` alone skips an MSAA buffer the size of the viewport.
 *  `alpha` is left at its default: the mesh composites over the CSS floor
 *  below it. */
const GL_ATTRS: WebGLContextAttributes = {
  powerPreference: 'low-power',
  antialias: false,
  depth: false,
  stencil: false,
}

interface Props {
  /** The ten mesh stops, read off the --mesh-* tokens by AmbientBackground so
   *  the palette follows the theme. Hex strings. */
  colors: string[]
  still: boolean
}

export default function MeshField({ colors, still }: Props) {
  if (still) {
    return (
      <StaticMeshGradient
        style={FILL}
        colors={colors}
        waveX={0.4}
        waveY={0.4}
        mixing={0.6}
        grainMixer={0}
        grainOverlay={0}
      />
    )
  }

  return (
    <MeshGradient
      style={FILL}
      colors={colors}
      /* Held in ambientControl, because a thaw has to restore this exact
         value — see MESH_SPEED there. */
      speed={MESH_SPEED}
      distortion={0.85}
      swirl={0.6}
      /* The shader's own grain is off: the app draws film grain in CSS above
         the canvas instead, at full device resolution rather than at whatever
         the shader is downsampling to. */
      grainMixer={0}
      grainOverlay={0}
      /* Ceiling on the drawing buffer — see MAX_PIXEL_COUNT above. Without one
         a desktop at 2× DPR asks the GPU for ~8M pixels a frame for a
         background nobody is looking at. */
      maxPixelCount={MAX_PIXEL_COUNT}
      webGlContextAttributes={GL_ATTRS}
    />
  )
}
