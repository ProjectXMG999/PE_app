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
      ctx.resume().then(() => {
        console.log('[audio] ctx.resume() resolved, state=', ctx!.state)
      })
    }

    console.log('[audio] AudioContext state:', ctx.state)

    // Play silent audio to further unlock iOS audio playback
    const silence = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
    silence.volume = 0
    silence.play().catch(() => {}) // ignore errors
  } catch (e) {
    console.error('[audio] unlockAudioGlobally error:', e)
  }
}

/**
 * Get the global AudioContext if it exists
 */
export function getAudioContext(): AudioContext | null {
  return ctx
}

/**
 * Wait for AudioContext to be running (after resume completes or if already running)
 * Resolves immediately if already running or no context exists
 */
export function awaitAudioUnlock(): Promise<void> {
  if (!ctx || ctx.state === 'running') return Promise.resolve()
  // Try to resume and wait for it
  return ctx.resume().then(() => {}).catch(() => {})
}

/**
 * Check if audio is unlocked (AudioContext is running)
 */
export function isAudioUnlocked() {
  return ctx !== null && ctx.state === 'running'
}
