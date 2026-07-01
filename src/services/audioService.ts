const AUDIO_BASE = '/.netlify/functions/audio'

export function getAudioUrl(packId: string, filename: string): string {
  return `${AUDIO_BASE}?pack=${encodeURIComponent(packId)}&file=${encodeURIComponent(filename)}`
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
