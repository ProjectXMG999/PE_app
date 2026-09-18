// Round 4 of Etap 0: the carrier phrase was still clipping word endings
// after round 2's margin widening. Root cause: postProcessClip's silence
// trim ran on every clip, including already-precisely-cut carrier segments
// — a word's natural trailing decay can dip under the silence threshold
// within the cut's own margin, so the trim quietly ate back into real word
// audio. Carrier clips here skip silence-trim entirely (see ffmpegPost.ts).
//
// Three variants per word:
//   baseline      — today's production settings, no post-processing
//   carrier       — fixed cut (wider end margin, no silence-trim) + loudnorm + longer fade
//   carrier-raw   — the exact same cut, but ZERO post-processing (no loudnorm,
//                   no fade) — isolates whether the processing chain itself
//                   (not just the cut) is still contributing to abruptness
//
// 70 words: 30 random <=5 chars, 20 random >7 chars, 20 random from
// Skróty+Slang combined. Voices exclude Violetta and Paweł per feedback.
//
// Usage: npx tsx --env-file=.env scripts/audio/ab-sample-round4.ts

import fs from 'fs'
import path from 'path'
import { AUDIO_OUT_DIR, PACK_DIR, createLimiter } from './lib/config.js'
import { ttsPlain, ttsWithTimestamps } from './lib/elevenLabsClient.js'
import { postProcessClip, cutClip } from './lib/ffmpegPost.js'
import { CARRIER_TEMPLATES, extractWordSpan } from './lib/carrierPhrase.js'
import { VoiceSettings, CARRIER_SETTINGS } from './lib/voicePresets.js'

const OUT_DIR = path.join(AUDIO_OUT_DIR, '_ab-sample-r4')
fs.mkdirSync(OUT_DIR, { recursive: true })

const BASELINE: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 0.75 }
const BASELINE_PL: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true }

// Violetta and Paweł excluded per feedback; Samantha dropped ("robi off"),
// replaced with Kristen.
const PL_VOICES = [
  { id: 'o2xdfKUpc1Bwq7RchZuW', name: 'Piotr' },
  { id: 'N0GCuK2B0qwWozQNTS8F', name: 'Magdalena' },
]
const EN_VOICES = [
  { id: 'wBXNqKUATyqu0RtYt25i', name: 'Adam (US)' },
  { id: 'dfeOmy6Uay63tNhyO99j', name: 'Kristen (US)' },
  { id: 'fjnwTZkKtQOJaYzGLa6n', name: 'William (UK)' },
  { id: 'dAlhI9qAHVIjXuVppzhW', name: 'Tamsin (UK)' },
]

interface RawItem { wordId: string; lang: 'en' | 'pl'; text: string }
interface Item extends RawItem { id: string; category: string; voiceId: string; voiceName: string }

const raw = JSON.parse(fs.readFileSync('/tmp/round4-words.json', 'utf-8')) as Record<string, RawItem[]>

function buildItems(): Item[] {
  const items: Item[] = []
  let ei = 0, pi = 0
  for (const [category, list] of Object.entries(raw)) {
    for (const r of list) {
      const voice = r.lang === 'en' ? EN_VOICES[ei++ % EN_VOICES.length] : PL_VOICES[pi++ % PL_VOICES.length]
      items.push({ ...r, id: `${r.wordId.replace(/-/g, '')}_${r.lang}`, category, voiceId: voice.id, voiceName: voice.name })
    }
  }
  return items
}

function withPeriod(text: string): string { return /[.!?;]$/.test(text.trim()) ? text : text.trim() + '.' }

interface ManifestEntry { id: string; wordId: string; category: string; lang: string; text: string; voice: string; baselineFile?: string; carrierFile?: string; carrierRawFile?: string }
const manifest: ManifestEntry[] = []

async function generateOne(it: Item) {
  const entry: ManifestEntry = { id: it.id, wordId: it.wordId, category: it.category, lang: it.lang, text: it.text, voice: it.voiceName }
  try {
    const baselineFile = `${it.id}__baseline.mp3`
    await ttsPlain(withPeriod(it.text), it.voiceId, it.lang === 'en' ? BASELINE : BASELINE_PL, path.join(OUT_DIR, baselineFile), `baseline ${it.id}`)
    entry.baselineFile = baselineFile
  } catch (e) { console.error(`\nbaseline failed ${it.id} (${it.text}): ${(e as Error).message}`) }

  try {
    const carrierText = CARRIER_TEMPLATES[it.lang](it.text)
    const { buffer, alignment } = await ttsWithTimestamps(carrierText, it.voiceId, CARRIER_SETTINGS, `carrier-v3 ${it.id}`)
    const rawInPath = path.join(OUT_DIR, `${it.id}__rawin.mp3`)
    fs.writeFileSync(rawInPath, buffer)
    const { startSec, endSec } = extractWordSpan(carrierText, it.text, alignment)
    const rawFile = `${it.id}__carrier-raw.mp3`
    const rawPath = path.join(OUT_DIR, rawFile)
    await cutClip(rawInPath, rawPath, startSec, endSec)
    fs.unlinkSync(rawInPath)
    entry.carrierRawFile = rawFile

    const processedFile = `${it.id}__carrier.mp3`
    const processedPath = path.join(OUT_DIR, processedFile)
    fs.copyFileSync(rawPath, processedPath)
    await postProcessClip(processedPath, { trimSilence: false, fadeOutMs: 80 })
    entry.carrierFile = processedFile
  } catch (e) { console.error(`\ncarrier failed ${it.id} (${it.text}): ${(e as Error).message}`) }

  manifest.push(entry)
}

async function main() {
  const items = buildItems()
  console.log(`Items: ${items.length}`)
  const limit = createLimiter(4)
  let done = 0
  await Promise.all(items.map((it) => limit(async () => {
    await generateOne(it)
    done++
    process.stdout.write(`\r[${done}/${items.length}]`)
  })))
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\nDone. ${manifest.length} entries, ${manifest.filter(m => m.baselineFile).length} baseline / ${manifest.filter(m => m.carrierFile).length} carrier / ${manifest.filter(m => m.carrierRawFile).length} carrier-raw ok.`)
}

main()
