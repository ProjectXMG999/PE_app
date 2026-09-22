import { getAudioContext } from './audioUnlock'
import { keyForLevel } from './tonality'

/**
 * A breathing pad under the listening mode.
 *
 * Słuchaj is minutes of clips separated by silence, and the silence is what
 * makes it feel like a file playing rather than a place to be. This fills it
 * with something that does one thing beyond filling: it swells over four
 * seconds and falls over six — the cadence of a slow breath. Nothing asks the
 * listener to breathe along; after a minute most people do anyway, and that is
 * the whole point of choosing this shape over a flat drone.
 *
 * It sits high: two octaves above the level's root, so there is no sub-bass
 * rumble, and it peaks at about −38 dB — quieter than the drone it replaced,
 * because the ear is far more sensitive up here than it was down at 65 Hz.
 * Present in a quiet room on headphones, gone the moment the voice starts.
 *
 * Synthesised, not a loop file — nothing to download and nothing to precache.
 *
 * The breath cycle runs on an oscillator with a custom waveform rather than on
 * scheduled ramps: it lives on the audio thread, so a backgrounded tab or a
 * throttled timer can't stall the swell halfway, and there is no schedule to
 * top up for a session of any length.
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

/** Top of the swell, ≈ −38 dB. */
const PEAK_GAIN = 0.012
/** Bottom of it. Never silence — the room shouldn't empty out between breaths. */
const FLOOR_GAIN = 0.003
/** One full breath, in seconds. */
const BREATH_SEC = 10
/** Of that, the part spent rising. The longer fall is what makes it calming. */
const INHALE = 0.4
const FADE_SEC = 1.6

/** Voices, as multiples of the level's root, with their relative weights. */
const VOICES: { mult: number; detune: number; gain: number }[] = [
  { mult: 4, detune: -5, gain: 0.5 },
  { mult: 4, detune: 5, gain: 0.5 },
  { mult: 6, detune: 0, gain: 0.3 },
  { mult: 8, detune: 3, gain: 0.1 },
]

interface PadNodes {
  voices: { osc: OscillatorNode; mult: number }[]
  noise: AudioBufferSourceNode
  breath: OscillatorNode
  fade: GainNode
  env: GainNode
  filter: BiquadFilterNode
  breathGain: GainNode
}

let nodes: PadNodes | null = null

/**
 * Starts the pad in the level's key (see audio/tonality.ts).
 *
 * Idempotent: calling it again while running only re-tunes, so a card change
 * can't stack a second pad on top of the first — and moving up a level glides
 * the pad across rather than restarting it mid-breath.
 */
export function startStudyPad(level: number | null | undefined): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const rootHz = keyForLevel(level).rootHz

  if (nodes) {
    retune(ctx, nodes, rootHz)
    return
  }

  const fade = ctx.createGain()
  fade.gain.setValueAtTime(0.0001, ctx.currentTime)
  fade.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_SEC)
  fade.connect(ctx.destination)

  // The breath itself: the gain rests at the midpoint and the oscillator below
  // swings it between FLOOR and PEAK.
  const env = ctx.createGain()
  env.gain.value = (PEAK_GAIN + FLOOR_GAIN) / 2
  env.connect(fade)

  const breath = ctx.createOscillator()
  breath.setPeriodicWave(breathWave(ctx))
  breath.frequency.value = 1 / BREATH_SEC
  const breathGain = ctx.createGain()
  // The wave spans ±0.5 around zero (its DC term is dropped by Web Audio), so
  // the full peak-to-floor distance here lands it exactly on FLOOR and PEAK.
  breathGain.gain.value = PEAK_GAIN - FLOOR_GAIN
  breath.connect(breathGain)
  breathGain.connect(env.gain)
  breath.start()

  // Low-pass rather than bare sines: it takes the glassy edge off the top
  // voice, which at level 3 sits near 880 Hz and would otherwise ring.
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 850
  filter.Q.value = 0.4
  filter.connect(env)

  // Pairs a few cents apart. The beating between them is what keeps this from
  // being a lifeless organ chord.
  const voices = VOICES.map(v => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = rootHz * v.mult
    osc.detune.value = v.detune
    const g = ctx.createGain()
    g.gain.value = v.gain
    osc.connect(g)
    g.connect(filter)
    osc.start()
    return { osc, mult: v.mult }
  })

  // A trace of air under the tone — without it this is a synth swell rather
  // than a breath. Loud enough to hear only on headphones in a quiet room.
  const noise = ctx.createBufferSource()
  noise.buffer = breathNoise(ctx)
  noise.loop = true
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 520
  band.Q.value = 0.6
  const noiseGain = ctx.createGain()
  noiseGain.gain.value = 0.22
  noise.connect(band)
  band.connect(noiseGain)
  // Post-filter, straight into the envelope: the air breathes with the tone.
  noiseGain.connect(env)
  noise.start()

  nodes = { voices, noise, breath, fade, env, filter, breathGain }
}

function retune(ctx: AudioContext, n: PadNodes, rootHz: number): void {
  for (const v of n.voices) {
    v.osc.frequency.setTargetAtTime(rootHz * v.mult, ctx.currentTime, 0.4)
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
  n.fade.gain.cancelScheduledValues(ctx.currentTime)
  n.fade.gain.setValueAtTime(n.fade.gain.value, ctx.currentTime)
  n.fade.gain.linearRampToValueAtTime(0.0001, end)

  for (const v of n.voices) v.osc.stop(end + 0.05)
  n.breath.stop(end + 0.05)
  n.noise.stop(end + 0.05)
  window.setTimeout(() => {
    try {
      n.fade.disconnect()
      n.env.disconnect()
      n.filter.disconnect()
      n.breathGain.disconnect()
    } catch {
      // Already torn down by the context; nothing to clean up.
    }
  }, (FADE_SEC + 0.3) * 1000)
}

export function isStudyPadRunning(): boolean {
  return nodes != null
}

/**
 * The breath as a waveform: raised cosine up over INHALE of the cycle, raised
 * cosine down over the rest. Fourier coefficients computed once — the curve is
 * smooth, so a dozen harmonics reproduce it without visible ripple.
 *
 * Cached against its context: a PeriodicWave belongs to the context that made
 * it, and reusing one across a rebuilt context throws.
 */
let waveCache: { ctx: AudioContext; wave: PeriodicWave } | null = null

function breathWave(ctx: AudioContext): PeriodicWave {
  if (waveCache?.ctx === ctx) return waveCache.wave

  const shape = (t: number): number =>
    t < INHALE
      ? 0.5 - 0.5 * Math.cos((Math.PI * t) / INHALE)
      : 0.5 + 0.5 * Math.cos((Math.PI * (t - INHALE)) / (1 - INHALE))

  const harmonics = 12
  const samples = 512
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let k = 1; k <= harmonics; k++) {
    let a = 0
    let b = 0
    for (let i = 0; i < samples; i++) {
      const t = i / samples
      const f = shape(t)
      a += f * Math.cos(2 * Math.PI * k * t)
      b += f * Math.sin(2 * Math.PI * k * t)
    }
    real[k] = (2 / samples) * a
    imag[k] = (2 / samples) * b
  }

  // disableNormalization: the coefficients above already put the wave at ±0.5,
  // and breathGain is scaled against exactly that.
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true })
  waveCache = { ctx, wave }
  return wave
}

/** Four seconds of brown noise, looped. Cached for the same reason. */
let noiseCache: { ctx: AudioContext; buffer: AudioBuffer } | null = null

function breathNoise(ctx: AudioContext): AudioBuffer {
  if (noiseCache?.ctx === ctx) return noiseCache.buffer

  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 4), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    // Brown rather than white: the random walk tilts the spectrum down, which
    // is what makes it read as air instead of as hiss.
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    data[i] = last * 3.2
  }
  noiseCache = { ctx, buffer }
  return buffer
}
