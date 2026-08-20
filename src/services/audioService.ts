import { useAuthStore } from '../store/useAuthStore'

const AUDIO_BASE = '/.netlify/functions/audio'

// <audio> elements load via .src and can't send an Authorization header, so the
// access token rides along as a query param instead — the audio function's
// requireEntitledUser() accepts either.
export function getAudioUrl(packId: string, filename: string): string {
  const token = useAuthStore.getState().accessToken
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
  return `${AUDIO_BASE}?pack=${encodeURIComponent(packId)}&file=${encodeURIComponent(filename)}${tokenParam}`
}

export async function preloadAudio(url: string): Promise<void> {
  try {
    await fetch(url, { mode: 'same-origin' })
  } catch {
    // silent — preload is best-effort
  }
}
