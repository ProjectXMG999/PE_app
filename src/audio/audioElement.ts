let audioEl: HTMLAudioElement | null = null

export function getAudioElement(): HTMLAudioElement | null {
  if (audioEl) return audioEl
  if (typeof document === 'undefined') return null
  audioEl = document.createElement('audio')
  audioEl.crossOrigin = 'anonymous'
  audioEl.style.display = 'none'
  document.body.appendChild(audioEl)
  return audioEl
}
