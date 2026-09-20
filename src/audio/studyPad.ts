import { getAudioContext } from './audioUnlock'
import { keyForLevel } from './tonality'

/**
 * A quiet drone under the listening mode.
 *
 * Słuchaj is minutes of clips separated by silence, and the silence is what
 * makes it feel like a file playing rather than a place to be. A pad at the
 * threshold of hearing fills it without competing with the voice: two detuned
 * oscillators through a low-pass filter whose cutoff drifts, so it never sits
 * still enough to become a tone you notice.
 *
 * Synthesised, not a loop file — nothing to download and nothing to precache.
 *
 * ── Why this does NOT replace audio/keepAlive.ts ────────────────────────────
 * It was meant to: a quiet pad holds timers awake the same way a silent WAV
 * loop does, and it would have been one mechanism instead of two. It can't.
 * keepAlive is a *media element*, which is what mobile browsers give background
 * audio privileges to; a Web Audio graph is not, and iOS suspends the
 * AudioContext when the page is backgrounded unless a media element is playing.
 * Replacing the loop with this would have quietly broken screen-off listening
 * on the platform that needs it most. The two stay separate.
 */

/** −30 dB. Present in a quiet room, inaudible against the voice. */
const PEAK_GAIN = 0.032
const FADE_SEC = 1.6

interface PadNodes {
  osc: OscillatorNode[]
  gain: GainNode
  filter: BiquadFilterNode
  lfo: OscillatorNode
  lfoGain: GainNode
}

let nodes: PadNodes | null = null

/**
 * Starts the pad in the level's key (see audio/tonality.ts).
 *
 * Idempotent: calling it again while running only re-tunes, so a card change
 * can't stack a second drone on top of the first — and moving up a level
 * glides the drone across rather than restarting it.
 */
export function startStudyPad(level: number | null | undefined): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const rootHz = keyForLevel(level).rootHz

  if (nodes) {
    retune(ctx, nodes, rootHz)
    return
  }

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(PEAK_GAIN, ctx.currentTime + FADE_SEC)
  gain.connect(ctx.destination)

  // Low-pass rather than a pure sine: the filter is what makes it a pad and not
  // a test tone, and sweeping its cutoff is cheaper than layering more voices.
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 420
  filter.Q.value = 0.7
  filter.connect(gain)

  // A very slow sweep — a full cycle takes about 40 seconds, well below the
  // rate at which a listener would hear it as movement rather than as air.
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.025
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 180
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)
  lfo.start()

  // Two voices a few cents apart. The beating between them is the whole effect;
  // in unison this is a single lifeless tone.
  const osc = [0, 1].map(i => {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = rootHz
    o.detune.value = i === 0 ? -7 : 7
    o.connect(filter)
    o.start()
    return o
  })

  nodes = { osc, gain, filter, lfo, lfoGain }
}

function retune(ctx: AudioContext, n: PadNodes, rootHz: number): void {
  for (const o of n.osc) {
    o.frequency.setTargetAtTime(rootHz, ctx.currentTime, 0.4)
  }
}

/** Fades out and tears the graph down. Safe to call when nothing is running. */
export function stopStudyPad(): void {
  const ctx = getAudioContext()
  const n = nodes
  if (!ctx || !n) {
    nodes = null
    return
  }
  nodes = null

  const end = ctx.currentTime + FADE_SEC
  // cancelScheduledValues first: without it a stop landing mid-fade-in keeps
  // ramping toward full gain while this ramp tries to take it down.
  n.gain.gain.cancelScheduledValues(ctx.currentTime)
  n.gain.gain.setValueAtTime(n.gain.gain.value, ctx.currentTime)
  n.gain.gain.linearRampToValueAtTime(0.0001, end)

  for (const o of n.osc) o.stop(end + 0.05)
  n.lfo.stop(end + 0.05)
  window.setTimeout(() => {
    try {
      n.gain.disconnect()
      n.filter.disconnect()
      n.lfoGain.disconnect()
    } catch {
      // Already torn down by the context; nothing to clean up.
    }
  }, (FADE_SEC + 0.3) * 1000)
}

export function isStudyPadRunning(): boolean {
  return nodes != null
}
