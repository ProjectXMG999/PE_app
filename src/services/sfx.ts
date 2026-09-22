import { getAudioContext } from '../audio/audioUnlock'
import { degreeHz, keyForLevel } from '../audio/tonality'
import { useAppStore } from '../store/useAppStore'

/**
 * Short, synthesized UI sounds (Web Audio oscillator + gain envelope) — no
 * audio files. The app has no UI-SFX infra otherwise; the audio/ pipeline is
 * tightly coupled to word/sentence playback and would collide with it if
 * reused here. Silently does nothing until the shared AudioContext has been
 * unlocked by a user gesture elsewhere (see audioUnlock.ts), or when the user
 * has turned sound off in Personalizacja.
 */

/** `attack` defaults to the 12ms of every tick and chime here; a swell passes
 *  a long one, which is most of what separates a curtain from a notification. */
function tone(
  ctx: AudioContext, freq: number, startAt: number, duration: number,
  peakGain: number, attack = 0.012,
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

/**
 * How long a sound may wait for a context that is still coming up.
 *
 * Long enough for the unlock a tap just asked for (measured in WebKit: a
 * context is still 'suspended' through the microtask AND the `setTimeout(0)`
 * after the resume() that unlocks it, and comes up a few ms later — longer on
 * a phone). Short enough that it is still the sound of the thing that caused
 * it: past this the sound is dropped rather than played late.
 */
const RESUME_GRACE_MS = 800

/**
 * Plays `build` against the shared context, waiting out an unlock in flight.
 *
 * A suspended context freezes currentTime, so everything scheduled against it
 * queues up silently and then fires AT ONCE the moment it resumes — a phone
 * that spent a Słuchaj session with its screen off would come back to a pile-up
 * of every chime it missed. So nothing is ever scheduled against a suspended
 * context; the sound waits for the resume to actually land and reads a live
 * currentTime, and gives up if that takes longer than a sound can survive.
 *
 * Refusing outright (what this used to do) was correct only while every sound
 * fired a comfortable distance from the tap that unlocks audio. Since page
 * chunks stopped suspending, the session curtain mounts in the very same task
 * as that tap — so the curtain's chord, the one sound that is *always* fired
 * by the unlocking gesture, was the one sound that could never be heard.
 */
function withAudio(build: (ctx: AudioContext) => void): void {
  if (!useAppStore.getState().soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'running') {
    build(ctx)
    return
  }
  const asked = Date.now()
  ctx.resume().then(() => {
    // Both guards matter: a context can resolve resume() without having come
    // up, and a context that comes up minutes later (the screen went off with
    // the tab backgrounded) must not still fire this.
    if (ctx.state !== 'running') return
    if (Date.now() - asked > RESUME_GRACE_MS) return
    build(ctx)
  }).catch(() => { /* no gesture to spend — try again next sound */ })
}

/** A soft confirmation tick — level picked, primary action pressed. */
export function playTick() {
  withAudio(ctx => tone(ctx, 660, ctx.currentTime, 0.09, 0.05))
}

/** A gentle rising chime — the "day complete" moment. */
export function playSuccess() {
  withAudio(ctx => {
    const now = ctx.currentTime
    tone(ctx, 523.25, now, 0.16, 0.06)
    tone(ctx, 659.25, now + 0.09, 0.18, 0.06)
    tone(ctx, 783.99, now + 0.18, 0.28, 0.06)
  })
}

/**
 * A badge chime that grows with the badge: bronze is a bright three-note lift,
 * each tier above it adds a note on top and a touch more sustain, so a legend
 * badge rings noticeably longer without ever getting louder.
 */
export function playUnlock(tier: 'bronze' | 'silver' | 'gold' | 'legend') {
  withAudio(ctx => {
    const now = ctx.currentTime
    // C major pentatonic climbing from G5 — no note can clash with another.
    const notes = [783.99, 880, 1046.5, 1318.51, 1567.98]
    const count = { bronze: 3, silver: 3, gold: 4, legend: 5 }[tier]
    const tail = { bronze: 0.3, silver: 0.36, gold: 0.44, legend: 0.6 }[tier]
    for (let i = 0; i < count; i++) {
      const last = i === count - 1
      tone(ctx, notes[i], now + i * 0.075, last ? tail : 0.14, last ? 0.05 : 0.04)
    }
  })
}

/**
 * The curtain's noise bed, synthesised once.
 *
 * This loop runs `sampleRate × duration` times — ~31 000 iterations at 44.1 kHz
 * — on the main thread, and `playSessionCurtain` fires from the curtain's mount
 * effect. That put it in the first frames of entering a study mode, on top of
 * the route's own mount and whatever the view transition was still animating:
 * one of the few pieces of real JS in a window that is otherwise starved for
 * main-thread time.
 *
 * Nothing about it varies. It is noise, the duration is the same every time,
 * and an AudioBuffer can be handed to any number of BufferSources — so it is
 * built at most once per AudioContext and kept.
 *
 * Keyed on the context, not global: a buffer belongs to the context that
 * created it, and the sample rate can differ between them (a Bluetooth device
 * connecting mid-session re-rates the context on some platforms). A WeakMap so
 * a discarded context takes its buffer with it.
 */
const noiseBeds = new WeakMap<AudioContext, AudioBuffer>()

function brownNoise(ctx: AudioContext): AudioBuffer {
  const cached = noiseBeds.get(ctx)
  if (cached) return cached

  const len = Math.ceil(ctx.sampleRate * CURTAIN_SWEEP_S)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    data[i] = last * 3.5
  }
  noiseBeds.set(ctx, buf)
  return buf
}

/**
 * Build the noise bed ahead of the first curtain, when nothing is waiting.
 *
 * Called from the audio unlock, which is the tap that opens a session — the
 * work then lands while the route is still being fetched rather than in the
 * frames the curtain is animating. Best-effort: if the context isn't up yet,
 * the curtain builds it itself, exactly as it used to.
 */
export function warmCurtainSound(): void {
  const idle = window.requestIdleCallback
  const run = () => {
    const ctx = getAudioContext()
    if (ctx) brownNoise(ctx)
  }
  if (idle) idle(() => run(), { timeout: 1000 })
  else window.setTimeout(run, 200)
}

/** How long the sweep runs — and therefore how long its noise bed is. */
const CURTAIN_SWEEP_S = 0.7

/**
 * The breath of moving fabric under the chord. Without it the curtain is just
 * an arpeggio; with it something is travelling. Brown noise through a bandpass
 * that climbs 300 → 900 Hz — the same technique the drone uses (audio/studyPad.ts
 * runs its own brown noise through a fixed 520 Hz bandpass), swept instead of parked.
 */
function curtainSweep(ctx: AudioContext, startAt: number, peakGain: number) {
  const duration = CURTAIN_SWEEP_S
  const src = ctx.createBufferSource()
  src.buffer = brownNoise(ctx)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 0.9
  band.frequency.setValueAtTime(300, startAt)
  band.frequency.exponentialRampToValueAtTime(900, startAt + duration)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + duration * 0.45)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  src.connect(band)
  band.connect(gain)
  gain.connect(ctx.destination)
  src.start(startAt)
  src.stop(startAt + duration + 0.02)
}

/**
 * The curtain going up — the sound of a study session opening.
 *
 * Four voices of the level's own key (audio/tonality.ts, so this can never
 * drift out of tune with the drone that plays underneath Słuchaj), entering
 * from the bottom 90ms apart. The rise is in the voicing, not in a melody:
 * nothing here is a tune, it is a chord assembling upwards while the title
 * card sits on screen, and it has stopped by the time the curtain lifts.
 *
 * Deliberately quieter than `playSuccess` despite being longer and fuller —
 * a 180ms attack and descending peaks keep it behind the screen rather than
 * on top of it. It is a room opening, not a notification.
 *
 * Runs about 1.2s, which is `OPENER_MIN_MS`: it resolves as the curtain moves.
 */
export function playSessionCurtain(level?: number | null) {
  withAudio(ctx => {
    const now = ctx.currentTime
    const key = keyForLevel(level)

    // Root and fifth low, then root and third an octave up — an open spread that
    // stays consonant in all four keys tonality.ts defines, major and modal alike.
    const voices = [
      { degree: 0, octave: 2, peak: 0.045 },
      { degree: 4, octave: 2, peak: 0.038 },
      { degree: 0, octave: 3, peak: 0.032 },
      { degree: 2, octave: 3, peak: 0.026 },
    ]
    voices.forEach((v, i) => {
      tone(ctx, degreeHz(key, v.degree, v.octave), now + i * 0.09, 1.1 - i * 0.05, v.peak, 0.18)
    })

    curtainSweep(ctx, now, 0.01)
  })
}
