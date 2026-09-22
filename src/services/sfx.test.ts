import { describe, it, expect, vi, beforeEach } from 'vitest'

/* A recording stand-in for the bits of Web Audio sfx.ts actually touches.
   The point is not to prove the browser works — it is that the curtain is in
   the level's key and that `canPlay` refuses in the two cases where a sound
   would be wrong rather than merely quiet. */
/* `rampAt` is absolute: tone() builds the gain envelope before it starts the
   oscillator, so the attack can only be worked out once both are known. */
interface Scheduled { freq: number; start: number; rampAt: number }

let scheduled: Scheduled[]
let buffers: number
let ctxState: AudioContextState
/* The gain node tone() builds belongs to the oscillator it just created. The
   noise sweep builds a gain of its own with no oscillator in front of it, so
   without this it claimed the last voice's envelope. */
let pending: Scheduled | null
let resumed: number
/** Brings the held-open `resume()` below back, as the browser eventually does. */
let releaseResume: (() => void) | null

function fakeContext() {
  const ctx = {
    get state() { return ctxState },
    currentTime: 10,
    sampleRate: 48000,
    destination: {},
    resume: () => {
      resumed++
      // Held open so a test can decide WHEN the context comes up — which is the
      // whole question for a sound fired by the tap that unlocks audio.
      return new Promise<void>(res => { releaseResume = () => { ctxState = 'running'; res() } })
    },
    createOscillator() {
      const rec: Scheduled = { freq: 0, start: 0, rampAt: 0 }
      scheduled.push(rec)
      pending = rec
      return {
        type: 'sine',
        frequency: { set value(v: number) { rec.freq = v }, get value() { return rec.freq } },
        connect() {},
        start(t: number) { rec.start = t },
        stop() {},
        _rec: rec,
      }
    },
    createGain() {
      const rec = pending
      pending = null
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime(_v: number, t: number) { if (rec) rec.rampAt = t },
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      }
    },
    createBuffer(_c: number, len: number) {
      buffers++
      return { getChannelData: () => new Float32Array(len) }
    },
    createBufferSource() {
      return { buffer: null, connect() {}, start() {}, stop() {} }
    },
    createBiquadFilter() {
      return {
        type: '',
        Q: { value: 0 },
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      }
    },
  }
  return ctx as unknown as AudioContext
}

let soundEnabled = true

vi.mock('../audio/audioUnlock', () => ({
  getAudioContext: () => fakeContext(),
}))
vi.mock('../store/useAppStore', () => ({
  useAppStore: { getState: () => ({ soundEnabled }) },
}))

const { playSessionCurtain } = await import('./sfx')

/** Equal temperament, to the cent — degreeHz's own formula, written out. */
const hz = (root: number, semitones: number, octave: number) =>
  root * Math.pow(2, semitones / 12 + octave)

beforeEach(() => {
  scheduled = []
  buffers = 0
  pending = null
  resumed = 0
  releaseResume = null
  ctxState = 'running'
  soundEnabled = true
  vi.useRealTimers()
})

describe('playSessionCurtain', () => {
  it('opens with four voices, bottom-up, 90ms apart', () => {
    playSessionCurtain(1)
    expect(scheduled).toHaveLength(4)

    const starts = scheduled.map(s => s.start - 10)
    for (const [i, expected] of [0, 0.09, 0.18, 0.27].entries()) {
      expect(starts[i]).toBeCloseTo(expected, 5)
    }

    // Ascending: the rise is in the voicing, which is what makes it a curtain
    // going up rather than a chord.
    const freqs = scheduled.map(s => s.freq)
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b))
  })

  it('is in the key the level is in', () => {
    // C major (level 1): root, fifth, octave, tenth.
    playSessionCurtain(1)
    const c = scheduled.map(s => s.freq)
    expect(c[0]).toBeCloseTo(hz(65.41, 0, 2), 2)   // C4
    expect(c[1]).toBeCloseTo(hz(65.41, 7, 2), 2)   // G4
    expect(c[2]).toBeCloseTo(hz(65.41, 0, 3), 2)   // C5
    expect(c[3]).toBeCloseTo(hz(65.41, 4, 3), 2)   // E5

    // A mixolydian (level 3) must not land on the same pitches.
    scheduled = []
    playSessionCurtain(3)
    const a = scheduled.map(s => s.freq)
    expect(a[0]).toBeCloseTo(hz(110, 0, 2), 2)
    expect(a).not.toEqual(c)
  })

  it('falls back to the neutral key when no level applies', () => {
    // Powtórka and Inteligentny are cross-level by nature.
    playSessionCurtain(null)
    const none = scheduled.map(s => s.freq)
    scheduled = []
    playSessionCurtain(1)
    expect(none).toEqual(scheduled.map(s => s.freq))
  })

  it('swells rather than ticks', () => {
    playSessionCurtain(1)
    // 12ms is the attack of every other sound here and reads as a strike.
    for (const s of scheduled) expect(s.rampAt - s.start).toBeCloseTo(0.18, 3)
    expect(buffers).toBe(1)   // the noise sweep under the chord
  })

  it('stays silent when the user has turned sound off', () => {
    soundEnabled = false
    playSessionCurtain(1)
    expect(scheduled).toHaveLength(0)
  })

  it('waits out an unlock in flight instead of dropping the sound', async () => {
    // The curtain is fired by the very tap that unlocks audio, and a context is
    // still 'suspended' for a few ms after the resume() that unlocks it
    // (measured in WebKit: through the microtask AND the setTimeout(0) after
    // it). Refusing here is what made the curtain silent on the phone.
    ctxState = 'suspended'
    playSessionCurtain(1)
    expect(scheduled).toHaveLength(0)   // nothing scheduled against a frozen clock
    expect(resumed).toBe(1)

    releaseResume!()
    await Promise.resolve()
    await Promise.resolve()
    expect(scheduled).toHaveLength(4)
  })

  it('drops a sound whose context only comes back much later', async () => {
    // A phone that spent the session with its screen off: currentTime is frozen
    // the whole time, and the context can come up minutes after the sound that
    // asked for it. Nothing here is worth hearing that late.
    vi.useFakeTimers()
    ctxState = 'suspended'
    playSessionCurtain(1)

    vi.advanceTimersByTime(30_000)
    releaseResume!()
    await Promise.resolve()
    await Promise.resolve()
    expect(scheduled).toHaveLength(0)
  })
})
