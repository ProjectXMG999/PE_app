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

function canPlay(): AudioContext | null {
  if (!useAppStore.getState().soundEnabled) return null
  const ctx = getAudioContext()
  if (!ctx) return null
  // A suspended context freezes currentTime, so everything scheduled against
  // it queues up silently and then fires AT ONCE the moment it resumes — a
  // phone that spent a Słuchaj session with its screen off comes back to a
  // pile-up of every chime it missed. Nothing here is worth hearing late, so
  // nothing is scheduled; the nudge is so a context that CAN come back does,
  // rather than staying mute for the rest of the session.
  //
  // This costs no existing sound: measured in WebKit, a context is still
  // 'suspended' in the same tick as the resume() that unlocks it, and nothing
  // in the app plays a sound in that tick — the two unlock sites navigate away
  // instead, and pressCta's tick fires before the unlock, as it already did.
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => { /* no gesture to spend — try again next sound */ })
    return null
  }
  return ctx
}

/** A soft confirmation tick — level picked, primary action pressed. */
export function playTick() {
  const ctx = canPlay()
  if (!ctx) return
  tone(ctx, 660, ctx.currentTime, 0.09, 0.05)
}

/** A gentle rising chime — the "day complete" moment. */
export function playSuccess() {
  const ctx = canPlay()
  if (!ctx) return
  const now = ctx.currentTime
  tone(ctx, 523.25, now, 0.16, 0.06)
  tone(ctx, 659.25, now + 0.09, 0.18, 0.06)
  tone(ctx, 783.99, now + 0.18, 0.28, 0.06)
}

/**
 * A badge chime that grows with the badge: bronze is a bright three-note lift,
 * each tier above it adds a note on top and a touch more sustain, so a legend
 * badge rings noticeably longer without ever getting louder.
 */
export function playUnlock(tier: 'bronze' | 'silver' | 'gold' | 'legend') {
  const ctx = canPlay()
  if (!ctx) return
  const now = ctx.currentTime
  // C major pentatonic climbing from G5 — no note can clash with another.
  const notes = [783.99, 880, 1046.5, 1318.51, 1567.98]
  const count = { bronze: 3, silver: 3, gold: 4, legend: 5 }[tier]
  const tail = { bronze: 0.3, silver: 0.36, gold: 0.44, legend: 0.6 }[tier]
  for (let i = 0; i < count; i++) {
    const last = i === count - 1
    tone(ctx, notes[i], now + i * 0.075, last ? tail : 0.14, last ? 0.05 : 0.04)
  }
}

/**
 * The breath of moving fabric under the chord. Without it the curtain is just
 * an arpeggio; with it something is travelling. Brown noise through a bandpass
 * that climbs 300 → 900 Hz — the same technique the drone uses (audio/studyPad.ts
 * runs its own brown noise through a fixed 520 Hz bandpass), swept instead of parked.
 */
function curtainSweep(ctx: AudioContext, startAt: number, duration: number, peakGain: number) {
  const len = Math.ceil(ctx.sampleRate * duration)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    data[i] = last * 3.5
  }

  const src = ctx.createBufferSource()
  src.buffer = buf
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
  const ctx = canPlay()
  if (!ctx) return
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

  curtainSweep(ctx, now, 0.7, 0.01)
}
