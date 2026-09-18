// Round 5 of Etap 0 — Polish only. English is settled on baseline
// (production settings, no carrier phrase). Polish carrier v3 sounded
// better than baseline but still clipped word endings.
//
// Insight from feedback: the carrier prefix ("Słowo: ") is fixed text
// spoken identically every time, so its start timestamp is reliable — the
// problem was always the estimated END. Carrier v4 cuts from the precise
// start to the clip's TRUE end (no estimated word-end at all) and trims
// only genuine trailing silence (quieter threshold, longer minimum
// duration than before, so it can't mistake the word's natural decay for
// silence).
//
// 30 Polish words (12 <=5 chars, 18 longer), Piotr + Magdalena only.
// Variants: baseline vs. carrier-v4.
//
// Usage: npx tsx --env-file=.env scripts/audio/ab-sample-round5.ts

import fs from 'fs'
import path from 'path'
import { AUDIO_OUT_DIR, createLimiter } from './lib/config.js'
import { ttsPlain, ttsWithTimestamps } from './lib/elevenLabsClient.js'
import { postProcessClip, cutClipFromStart, trimTrailingSilence } from './lib/ffmpegPost.js'
import { CARRIER_TEMPLATES, extractWordStart } from './lib/carrierPhrase.js'
import { PL_VOICES, VoiceSettings, CARRIER_SETTINGS } from './lib/voicePresets.js'

const OUT_DIR = path.join(AUDIO_OUT_DIR, '_ab-sample-r5')
fs.mkdirSync(OUT_DIR, { recursive: true })

const BASELINE_PL: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true }

const words = JSON.parse(fs.readFileSync('/tmp/round5-words.json', 'utf-8')) as string[]

interface Item { id: string; text: string; voiceId: string; voiceName: string }
const items: Item[] = words.map((text, i) => ({
  id: `${text.replace(/[^a-zA-Ząćęłńóśźż]/gi, '')}_${i}`,
  text,
  voiceId: PL_VOICES[i % PL_VOICES.length].id,
  voiceName: PL_VOICES[i % PL_VOICES.length].name,
}))

function withPeriod(text: string): string { return /[.!?;]$/.test(text.trim()) ? text : text.trim() + '.' }

interface ManifestEntry { id: string; text: string; voice: string; baselineFile?: string; carrierFile?: string }
const manifest: ManifestEntry[] = []

async function generateOne(it: Item) {
  const entry: ManifestEntry = { id: it.id, text: it.text, voice: it.voiceName }
  try {
    const baselineFile = `${it.id}__baseline.mp3`
    await ttsPlain(withPeriod(it.text), it.voiceId, BASELINE_PL, path.join(OUT_DIR, baselineFile), `baseline ${it.id}`)
    entry.baselineFile = baselineFile
  } catch (e) { console.error(`\nbaseline failed ${it.id} (${it.text}): ${(e as Error).message}`) }

  try {
    const carrierText = CARRIER_TEMPLATES.pl(it.text)
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
