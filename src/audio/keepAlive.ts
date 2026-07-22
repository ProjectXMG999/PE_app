// Silent keep-alive loop — a SECOND audio element looping a silent WAV during
// the sequence's silent gaps, so the browser keeps the page "audible":
// timers keep firing with the screen off and the media session stays alive.
//
// Android: reliable. iOS: usually helps for short gaps, but may confuse the
// Now Playing owner (the keep-alive element has no metadata). Gated behind the
// showDebug dev flag until device testing promotes it.

const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

let el: HTMLAudioElement | null = null

function ensureElement(): HTMLAudioElement | null {
  if (el) return el
  if (typeof document === 'undefined') return null
  el = document.createElement('audio')
  el.src = SILENT_WAV
  el.loop = true
  // Not 0 — iOS may classify truly muted audio as inaudible and suspend anyway
  el.volume = 0.01
  el.setAttribute('aria-hidden', 'true')
  el.style.display = 'none'
  document.body.appendChild(el)
  return el
}

/** Must be called synchronously within a user gesture (same tap as unlockAudioGlobally). */
export function unlockKeepAlive() {
  const audio = ensureElement()
  if (!audio) return
  audio.play().then(() => {
    audio.pause()
    console.log('[keepalive] unlocked')
  }).catch(() => {
    console.log('[keepalive] unlock failed')
  })
}

export function startKeepAlive() {
  const audio = ensureElement()
  if (!audio || !audio.paused) return
  audio.play().then(() => {
    console.log('[keepalive] started')
  }).catch(() => {
    console.log('[keepalive] start failed (not unlocked?)')
  })
}

export function stopKeepAlive() {
  if (!el || el.paused) return
  el.pause()
  console.log('[keepalive] stopped')
}
