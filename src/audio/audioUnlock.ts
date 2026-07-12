// Global audio unlock using AudioContext — permanently unlocks audio for iOS Safari
// Must be called synchronously from a user gesture (click/tap)

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
      ctx.resume()
    }

    console.log('[audio] AudioContext state:', ctx.state)

    // Belt-and-suspenders: also play silent HTMLAudio
    // On some browsers this might be necessary alongside AudioContext
    const silence = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
    silence.volume = 0
    silence.play().catch(() => {}) // ignore any errors
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
