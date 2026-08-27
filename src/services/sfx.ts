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
