const AUDIO_BASE = '/.netlify/functions/audio'

export function getAudioUrl(packId: string, filename: string): string {
  return `${AUDIO_BASE}?pack=${encodeURIComponent(packId)}&file=${encodeURIComponent(filename)}`
}

let currentAudio: HTMLAudioElement | null = null

export function playAudio(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    const audio = new HTMLAudioElement()
    audio.src = url
    audio.preload = 'auto'
    currentAudio = audio

    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('Audio failed to load'))
    audio.play().catch(reject)
  })
}

export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
}

export async function preloadAudio(url: string): Promise<void> {
  if ('caches' in window) {
    try {
      const cache = await caches.open('pe-audio-v1')
      const cached = await cache.match(url)
      if (!cached) {
        await cache.add(url)
      }
    } catch {
      // silent — preload is best-effort
    }
  }
}
