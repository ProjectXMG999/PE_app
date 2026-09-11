import { MeshGradient, StaticMeshGradient } from '@paper-design/shaders-react'

/**
 * The WebGL half of the ambient background, split into its own module so it can
 * be code-split away from the initial bundle — @paper-design/shaders-react is
 * by far the heaviest dependency on the page and none of it is needed to paint
 * the hero. AmbientBackground lazy-loads this after first paint.
 *
 * Palette and shader parameters are copied verbatim from the app
 * (src/components/today/AmbientBackground.tsx) — the landing has to be the same
 * atmosphere as the product, not a similar one.
 */
const COLORS = ['#080612', '#1a1442', '#241155', '#081a2c', '#080612']

const FILL = { width: '100%', height: '100%' } as const

export default function MeshField({ still }: { still: boolean }) {
  if (still) {
    return (
      <StaticMeshGradient
        style={FILL}
        colors={COLORS}
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
      colors={COLORS}
      speed={0.14}
      distortion={0.85}
      swirl={0.6}
      grainMixer={0}
      grainOverlay={0}
      maxPixelCount={2_100_000}
    />
  )
}
