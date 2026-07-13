const AUDIO_BASE = '/.netlify/functions/audio'

export function getAudioUrl(packId: string, filename: string): string {
  const url = `${AUDIO_BASE}?pack=${encodeURIComponent(packId)}&file=${encodeURIComponent(filename)}`
  console.log('[audio] getAudioUrl =', url)
  return url
}

export async function preloadAudio(url: string): Promise<void> {
  try {
    await fetch(url, { mode: 'same-origin' })
  } catch {
    // silent — preload is best-effort
  }
}
