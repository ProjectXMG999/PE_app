import { MeshGradient, StaticMeshGradient } from '@paper-design/shaders-react'

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

interface Props {
  /** The five mesh stops, read off the --mesh-* tokens by AmbientBackground so
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
      speed={0.14}
      distortion={0.85}
      swirl={0.6}
      /* The shader's own grain is off: the app draws film grain in CSS above
         the canvas instead, at full device resolution rather than at whatever
         the shader is downsampling to. */
      grainMixer={0}
      grainOverlay={0}
      /* Ceiling on the drawing buffer. Without it a desktop at 2× DPR asks the
         GPU for ~8M pixels a frame for a background nobody is looking at. */
      maxPixelCount={2_100_000}
    />
  )
}
