// Round 3 of Etap 0: 100 words focused on the hardest cases per
// docs/voicelab.md's hypothesis — short words (<=5 chars), abbreviations
// ("Skróty" category), and slang — comparing baseline (today's production
// settings, no post-processing) against the fixed carrier-phrase approach
// (carrier-v2 margins/speed from round 2). Word list at /tmp/round3-words.json
// (built by random sampling in the conversation, categories: short/skroty/slang).
//
// Usage: npx tsx --env-file=.env scripts/audio/ab-sample-round3.ts

import fs from 'fs'
import path from 'path'
import { AUDIO_OUT_DIR, PACK_DIR, createLimiter } from './lib/config.js'
import { ttsPlain, ttsWithTimestamps } from './lib/elevenLabsClient.js'
import { postProcessClip, cutClip } from './lib/ffmpegPost.js'
import { CARRIER_TEMPLATES, extractWordSpan } from './lib/carrierPhrase.js'
import { PL_VOICES, EN_VOICES, VoiceSettings, CARRIER_SETTINGS } from './lib/voicePresets.js'

const OUT_DIR = path.join(AUDIO_OUT_DIR, '_ab-sample-r3')
fs.mkdirSync(OUT_DIR, { recursive: true })

const BASELINE: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 0.75 }
const BASELINE_PL: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true }

interface RawItem { wordId: string; lang: 'en' | 'pl'; text: string }
interface Item extends RawItem { id: string; category: string; voiceId: string; voiceName: string }

const raw = JSON.parse(fs.readFileSync('/tmp/round3-words.json', 'utf-8')) as Record<string, RawItem[]>

function buildItems(): Item[] {
  const items: Item[] = []
  let i = 0
  for (const [category, list] of Object.entries(raw)) {
    for (const r of list) {
      const voice = r.lang === 'en' ? EN_VOICES[i % EN_VOICES.length] : PL_VOICES[i % PL_VOICES.length]
      items.push({ ...r, id: `${r.wordId.replace(/-/g, '')}_${r.lang}`, category, voiceId: voice.id, voiceName: voice.name })
      i++
    }
  }
  return items
}

function withPeriod(text: string): string { return /[.!?;]$/.test(text.trim()) ? text : text.trim() + '.' }

interface ManifestEntry { id: string; wordId: string; category: string; lang: string; text: string; voice: string; baselineFile?: string; carrierFile?: string }
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
    const { buffer, alignment } = await ttsWithTimestamps(carrierText, it.voiceId, CARRIER_SETTINGS, `carrier-v2 ${it.id}`)
    const rawPath = path.join(OUT_DIR, `${it.id}__raw.mp3`)
    fs.writeFileSync(rawPath, buffer)
    const { startSec, endSec } = extractWordSpan(carrierText, it.text, alignment)
    const carrierFile = `${it.id}__carrier.mp3`
    const outPath = path.join(OUT_DIR, carrierFile)
    await cutClip(rawPath, outPath, startSec, endSec)
    await postProcessClip(outPath)
    fs.unlinkSync(rawPath)
    entry.carrierFile = carrierFile
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
  console.log(`\nDone. ${manifest.length} entries, ${manifest.filter(m => m.baselineFile).length} baseline ok, ${manifest.filter(m => m.carrierFile).length} carrier ok.`)
}

main()
