// Global audio unlock using AudioContext — permanently unlocks audio for iOS Safari
// Must be called synchronously from a user gesture (click/tap)

import { getAudioElement } from './audioElement'

let ctx: AudioContext | null = null

/**
 * Unlock audio globally for the session using AudioContext.resume()
 * This works on iOS Safari to allow audio.play() without gesture context
 * Must be called synchronously from a user gesture handler
 */
export function unlockAudioGlobally() {
  console.log('[audio] unlockAudioGlobally called')
  try {
    // Create AudioContext if needed
    if (!ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        console.warn('[audio] AudioContext not available')
        return
      }
      ctx = new AudioContextClass()
    }

    // Resume if suspended (iOS Safari pattern)
    if (ctx.state === 'suspended') {
      console.log('[audio] AudioContext suspended, calling resume()')
      ctx.resume().then(() => {
        console.log('[audio] ctx.resume() resolved, state=', ctx!.state)
      })
    }

    console.log('[audio] AudioContext state:', ctx.state)

    // Play silent audio on the singleton element to activate it within the gesture context.
    // This is the same element useAudio will use for real playback — iOS ties unlock to the element.
    const el = getAudioElement()
    if (el) {
      el.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
      // The WAV is silent — do NOT set volume=0 here: iOS ignores element volume,
      // but Android/desktop persist it across src changes, muting all later playback
      el.volume = 1
      el.play().catch(() => {})
    }
  } catch (e) {
    console.error('[audio] unlockAudioGlobally error:', e)
  }
}

/**
 * Check if audio is unlocked (AudioContext is running)
 */
export function isAudioUnlocked() {
  return ctx !== null && ctx.state === 'running'
}
