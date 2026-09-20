import { GodRays } from '@paper-design/shaders-react'

/**
 * The light behind the pack-mastered screen — volumetric rays from just above
 * the medallion, in the reward palette (--rays-* in tokens.css).
 *
 * Why this screen, and only this screen. Two reasons, and neither is taste:
 *
 *  1. **The GPU is free here.** Session screens set `ambientHidden`, which
 *     unmounts the ambient mesh entirely (AmbientBackground.tsx). So this is
 *     one WebGL context, not a second one — the collision that
 *     progress/Constellation/Constellation.tsx documents as a real cost
 *     ("the browser drops a context rather than refusing one") cannot happen.
 *  2. **The glass here had nothing to blur.** Because the mesh is gone, the
 *     card's backdrop-filter was frosting a flat gradient — the app's most
 *     expensive material, rendered over nothing, at its most celebratory
 *     moment. The rays give it something to actually refract.
 *
 * Lazy-loaded from MasteryScreen for the same reason MeshField is lazy-loaded
 * from AmbientBackground: @paper-design/shaders-react is the heaviest
 * dependency in the app, and this chunk is only ever needed by someone who has
 * just finished a whole pack.
 *
 * colorBack is fully transparent (#00000000) on purpose: the screen's own
 * radial ground in MasteryScreen.css stays, and the rays composite over it
 * rather than replacing it.
 */
const FILL = { width: '100%', height: '100%' } as const

/** A frame far enough in that the static pose isn't the shader's flat frame 0. */
const STILL_FRAME = 9000

interface Props {
  /** Three ray colours read off --rays-* by MasteryScreen, so the light
   *  follows the theme. Hex strings — the library parses no other format. */
  colors: string[]
  still: boolean
}

export default function MasteryField({ colors, still }: Props) {
  return (
    <GodRays
      style={FILL}
      colors={colors}
      colorBack="#00000000"
      colorBloom={colors[0]}
      speed={still ? 0 : 0.5}
      frame={still ? STILL_FRAME : undefined}
      bloom={0.3}
      /* Restraint is the whole calibration here, and the first pass got it
         badly wrong: at intensity 0.2 with the layer at full opacity this read
         as a slot machine, not as this app. The medallion, the trophy and the
         confetti are already competing for the screen; the rays are the room
         those happen in, not a fourth thing to look at. The same rule the
         ambient ground is tuned by (tokens.css: felt at the edge of vision,
         never looked at) applies here — it just gets a larger budget, once,
         for a few seconds. The CSS layer's --rays-strength is the coarse knob;
         these are the fine ones. */
      intensity={0.1}
      density={0.3}
      spotty={0.3}
      midSize={0.5}
      midIntensity={0.08}
      /* Light source above the medallion rather than at the centre of the
         card, so the rays and the card's own lit rim agree about where the
         light is coming from. */
      offsetY={-0.5}
      /* Same ceiling logic as MeshField: a full-screen effect at 3x DPR asks
         for pixels nobody is looking at. Lower than the mesh's cap because
         this one runs for a few seconds, not for the whole session. */
      maxPixelCount={1_400_000}
    />
  )
}
