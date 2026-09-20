// Round 6 of Etap 0 — English, all 4 voices (Adam, Kristen, William,
// Tamsin), 25 words each = 100 words. Baseline vs. the fixed carrier v4
// (cut from precise start to true clip end, trim only genuine trailing
// silence). Final check before deciding whether to scale English's carrier
// phrase to production, or keep the earlier baseline-only decision.
//
// Usage: npx tsx --env-file=.env scripts/audio/ab-sample-round6.ts

import fs from 'fs'
import path from 'path'
import { AUDIO_OUT_DIR, createLimiter } from './lib/config.js'
import { ttsPlain, ttsWithTimestamps } from './lib/elevenLabsClient.js'
import { postProcessClip, cutClipFromStart, trimTrailingSilence } from './lib/ffmpegPost.js'
import { CARRIER_TEMPLATES, extractWordStart } from './lib/carrierPhrase.js'
import { EN_VOICES, VoiceSettings, CARRIER_SETTINGS } from './lib/voicePresets.js'

const OUT_DIR = path.join(AUDIO_OUT_DIR, '_ab-sample-r6')
fs.mkdirSync(OUT_DIR, { recursive: true })

const BASELINE_EN: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 0.75 }

const words = JSON.parse(fs.readFileSync('/tmp/round6-words.json', 'utf-8')) as string[]

interface Item { id: string; text: string; voiceId: string; voiceName: string }
const items: Item[] = words.map((text, i) => {
  const voice = EN_VOICES[Math.floor(i / 25) % EN_VOICES.length]
  return { id: `${text.replace(/[^a-zA-Z]/g, '')}_${i}`, text, voiceId: voice.id, voiceName: voice.name }
})

function withPeriod(text: string): string { return /[.!?;]$/.test(text.trim()) ? text : text.trim() + '.' }

interface ManifestEntry { id: string; text: string; voice: string; baselineFile?: string; carrierFile?: string }
const manifest: ManifestEntry[] = []

async function generateOne(it: Item) {
  const entry: ManifestEntry = { id: it.id, text: it.text, voice: it.voiceName }
  try {
    const baselineFile = `${it.id}__baseline.mp3`
    await ttsPlain(withPeriod(it.text), it.voiceId, BASELINE_EN, path.join(OUT_DIR, baselineFile), `baseline ${it.id}`)
    entry.baselineFile = baselineFile
  } catch (e) { console.error(`\nbaseline failed ${it.id} (${it.text}): ${(e as Error).message}`) }

  try {
    const carrierText = CARRIER_TEMPLATES.en(it.text)
    const { buffer, alignment } = await ttsWithTimestamps(carrierText, it.voiceId, CARRIER_SETTINGS, `carrier-v4 ${it.id}`)
    const rawInPath = path.join(OUT_DIR, `${it.id}__rawin.mp3`)
    fs.writeFileSync(rawInPath, buffer)
    const startSec = extractWordStart(carrierText, it.text, alignment)
    const cutPath = path.join(OUT_DIR, `${it.id}__cut.mp3`)
    await cutClipFromStart(rawInPath, cutPath, startSec)
    fs.unlinkSync(rawInPath)

    const trimmedPath = path.join(OUT_DIR, `${it.id}__trimmed.mp3`)
    await trimTrailingSilence(cutPath, trimmedPath)
    fs.unlinkSync(cutPath)

    const processedFile = `${it.id}__carrier-v4.mp3`
    const processedPath = path.join(OUT_DIR, processedFile)
    fs.renameSync(trimmedPath, processedPath)
    await postProcessClip(processedPath, { trimSilence: false, fadeOutMs: 60 })
    entry.carrierFile = processedFile
  } catch (e) { console.error(`\ncarrier failed ${it.id} (${it.text}): ${(e as Error).message}`) }

  manifest.push(entry)
}

async function main() {
  console.log(`Items: ${items.length}`)
  const limit = createLimiter(4)
  let done = 0
  await Promise.all(items.map((it) => limit(async () => {
    await generateOne(it)
    done++
    process.stdout.write(`\r[${done}/${items.length}]`)
  })))
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\nDone. ${manifest.length} entries, ${manifest.filter(m => m.baselineFile).length} baseline / ${manifest.filter(m => m.carrierFile).length} carrier-v4 ok.`)
}

main()
