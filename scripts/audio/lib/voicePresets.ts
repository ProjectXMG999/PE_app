// Per docs/voicelab.md Etap 1: words and sentences need different
// voice_settings. eleven_multilingual_v2 is context-dependent — bare
// isolated words get random prosody/cut-offs, so words get higher
// `stability` (less random variation) than sentences, which already sound
// good with the existing preset (unchanged here).
//
// NOTE: these exact numbers are voicelab.md's own stated Etap-1
// recommendation (stability 0.6, speed 0.8 "native" as the best compromise
// across voices), applied directly as a documented default — no Etap-0
// human listening A/B has been run yet to confirm them for this app's 8
// voices. Revisit if generated word audio still sounds cut off/robotic.

export interface VoiceSettings {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
  speed?: number
}

export const WORD_SETTINGS: VoiceSettings = {
  stability: 0.6,
  similarity_boost: 0.8,
  style: 0.2,
  use_speaker_boost: true,
  speed: 0.8,
}

// Sentences already sound natural (they have context) — keep the settings
// that were already in production, EN speed included. PL sentences keep no
// explicit speed (native), matching prior behavior.
export const SENTENCE_SETTINGS_EN: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.2,
  use_speaker_boost: true,
  speed: 0.75,
}

export const SENTENCE_SETTINGS_PL: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.2,
  use_speaker_boost: true,
}

export const PL_VOICES = [
  { id: 'o2xdfKUpc1Bwq7RchZuW', name: 'Piotr', gender: 'M' },
  { id: 'N0GCuK2B0qwWozQNTS8F', name: 'Magdalena', gender: 'F' },
  { id: 'zzBTsLBFM6AOJtkr1e9b', name: 'Pawel', gender: 'M' },
  { id: 'gfKKsLN1k0oYYN9n2dXX', name: 'Violetta', gender: 'F' },
]

export const EN_VOICES = [
  { id: 'wBXNqKUATyqu0RtYt25i', name: 'Adam', accent: 'US', gender: 'M' },
  { id: 'uIZsnBL0YK1S5j69bAih', name: 'Samantha', accent: 'US', gender: 'F' },
  { id: 'fjnwTZkKtQOJaYzGLa6n', name: 'William', accent: 'UK', gender: 'M' },
  { id: 'dAlhI9qAHVIjXuVppzhW', name: 'Tamsin', accent: 'UK', gender: 'F' },
]
