import fs from 'fs'
import path from 'path'
import { VoiceSettings } from './voicePresets.js'

const API_KEY = process.env.ELEVENLABS_API_KEY || ''
const MODEL_ID = 'eleven_multilingual_v2'

export type ErrorKind = 'concurrency' | 'busy' | 'transient' | 'fatal'

export class ElevenLabsError extends Error {
  constructor(public status: number, public body: string, public kind: ErrorKind) {
    super(`ElevenLabs ${status}: ${body.slice(0, 300)}`)
  }
}

/** Per docs/voicelab.md Etap 3: the two documented 429 reasons need different
 * handling — too_many_concurrent_requests should back off into the shared
 * queue (handled by the caller's limiter, not by retrying the same slot
 * faster), system_busy needs exponential backoff+jitter. Anything else 5xx
 * is transient; 4xx other than 429 is fatal (bad input, won't succeed on
 * retry). Exact JSON error-code field name is confirmed live below and may
 * need adjusting if ElevenLabs' shape differs from what's assumed here. */
function classifyError(status: number, body: string): ErrorKind {
  if (status === 429) {
    if (/too_many_concurrent_requests/i.test(body)) return 'concurrency'
    return 'busy'
  }
  if (status >= 500) return 'transient'
  return 'fatal'
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let attempt = 0
  let delay = 1000
  while (true) {
    try {
      return await fn()
    } catch (e) {
      if (!(e instanceof ElevenLabsError)) throw e
      attempt++
      if (e.kind === 'fatal' || attempt > 6) throw e
      const wait = e.kind === 'concurrency' ? 1500 : Math.min(delay, 32000)
      if (e.kind !== 'concurrency') delay *= 2
      const jitter = Math.floor(Math.random() * 300)
      process.stderr.write(`\n[retry ${attempt}] ${label}: ${e.kind} (${e.status}), waiting ${wait + jitter}ms\n`)
      await sleep(wait + jitter)
    }
  }
}

async function post(urlSuffix: string, body: Record<string, unknown>): Promise<Response> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${urlSuffix}`, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new ElevenLabsError(res.status, errBody, classifyError(res.status, errBody))
  }
  return res
}

/** Plain TTS, writes an mp3 to outputPath. Skips if the file already exists. */
export async function ttsPlain(text: string, voiceId: string, settings: VoiceSettings, outputPath: string, label: string): Promise<'generated' | 'skipped'> {
  if (fs.existsSync(outputPath)) return 'skipped'
  const buffer = await withRetry(async () => {
    const res = await post(voiceId, { text, model_id: MODEL_ID, voice_settings: settings })
    return Buffer.from(await res.arrayBuffer())
  }, label)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, buffer)
  return 'generated'
}

export interface Alignment {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

/** /with-timestamps — for Etap 0/2 carrier-phrase word audio: returns the
 * decoded mp3 buffer plus per-character alignment, so the caller can cut out
 * just the target word. Not used by the main word/sentence pipeline yet. */
export async function ttsWithTimestamps(text: string, voiceId: string, settings: VoiceSettings, label: string): Promise<{ buffer: Buffer; alignment: Alignment }> {
  return withRetry(async () => {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
      method: 'POST',
      headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: settings }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      throw new ElevenLabsError(res.status, errBody, classifyError(res.status, errBody))
    }
    const costHeader = res.headers.get('character-cost') ?? res.headers.get('cost') ?? null
    if (costHeader) process.stderr.write(`[cost header] ${label}: ${costHeader}\n`)
    const data = (await res.json()) as { audio_base64: string; alignment: Alignment }
    return { buffer: Buffer.from(data.audio_base64, 'base64'), alignment: data.alignment }
  }, label)
}

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY env var not set')
  process.exit(1)
}
