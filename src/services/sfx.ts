import { getAudioContext } from '../audio/audioUnlock'
import { useAppStore } from '../store/useAppStore'

/**
 * Short, synthesized UI sounds (Web Audio oscillator + gain envelope) — no
 * audio files. The app has no UI-SFX infra otherwise; the audio/ pipeline is
 * tightly coupled to word/sentence playback and would collide with it if
 * reused here. Silently does nothing until the shared AudioContext has been
 * unlocked by a user gesture elsewhere (see audioUnlock.ts), or when the user
 * has turned sound off in Personalizacja.
 */

function tone(ctx: AudioContext, freq: number, startAt: number, duration: number, peakGain: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

function canPlay(): AudioContext | null {
  if (!useAppStore.getState().soundEnabled) return null
  return getAudioContext()
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
