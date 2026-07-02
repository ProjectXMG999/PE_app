const AUDIO_BASE = '/.netlify/functions/audio'

export function getAudioUrl(packId: string, filename: string): string {
  return `${AUDIO_BASE}?pack=${encodeURIComponent(packId)}&file=${encodeURIComponent(filename)}`
}

export async function preloadAudio(url: string): Promise<void> {
  try {
    await fetch(url, { mode: 'same-origin' })
  } catch {
    // silent — preload is best-effort
  }
}
