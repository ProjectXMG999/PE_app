// Round 2 of Etap 0: fixes to the carrier-phrase cut (wider, asymmetric
// margins + longer fade-out — see lib/carrierPhrase.ts/lib/ffmpegPost.ts)
// and a slightly slower carrier speed, re-tested on the original 12 words
// plus 16 random words pulled from the full catalog (real material, not
// hand-picked) for a broader read before committing to scale.
//
// Usage: npx tsx --env-file=.env scripts/audio/ab-sample-round2.ts

import fs from 'fs'
import path from 'path'
import { AUDIO_OUT_DIR, PACK_DIR } from './lib/config.js'
import { ttsPlain, ttsWithTimestamps } from './lib/elevenLabsClient.js'
import { postProcessClip, cutClip } from './lib/ffmpegPost.js'
import { CARRIER_TEMPLATES, extractWordSpan } from './lib/carrierPhrase.js'
import { PL_VOICES, EN_VOICES, VoiceSettings, CARRIER_SETTINGS } from './lib/voicePresets.js'

const OUT_DIR = path.join(AUDIO_OUT_DIR, '_ab-sample')
fs.mkdirSync(OUT_DIR, { recursive: true })

const BASELINE: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 0.75 }
const BASELINE_PL: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true }

interface Item { id: string; lang: 'en' | 'pl'; text: string; voiceId: string; voiceName: string }

// The same 12 stress-test words from round 1 — re-cut only (carrier-v2), no baseline redo.
const REPEAT_WORDS: Item[] = [
  { id: 'be', lang: 'en', text: 'Be', voiceId: EN_VOICES[0].id, voiceName: EN_VOICES[0].name },
  { id: 'can', lang: 'en', text: 'Can', voiceId: EN_VOICES[1].id, voiceName: EN_VOICES[1].name },
  { id: 'have-to', lang: 'en', text: 'Have to', voiceId: EN_VOICES[2].id, voiceName: EN_VOICES[2].name },
  { id: 'hairdresser', lang: 'en', text: 'Hairdresser', voiceId: EN_VOICES[3].id, voiceName: EN_VOICES[3].name },
  { id: 'cook', lang: 'en', text: 'Cook', voiceId: EN_VOICES[0].id, voiceName: EN_VOICES[0].name },
  { id: 'city', lang: 'en', text: 'City', voiceId: EN_VOICES[1].id, voiceName: EN_VOICES[1].name },
  { id: 'byc', lang: 'pl', text: 'Być', voiceId: PL_VOICES[0].id, voiceName: PL_VOICES[0].name },
  { id: 'moc', lang: 'pl', text: 'Móc', voiceId: PL_VOICES[1].id, voiceName: PL_VOICES[1].name },
  { id: 'musisz', lang: 'pl', text: 'Musisz', voiceId: PL_VOICES[2].id, voiceName: PL_VOICES[2].name },
  { id: 'fryzjer', lang: 'pl', text: 'Fryzjer', voiceId: PL_VOICES[3].id, voiceName: PL_VOICES[3].name },
  { id: 'kucharz', lang: 'pl', text: 'Kucharz', voiceId: PL_VOICES[0].id, voiceName: PL_VOICES[0].name },
  { id: 'miasto', lang: 'pl', text: 'Miasto', voiceId: PL_VOICES[1].id, voiceName: PL_VOICES[1].name },
]

// Randomly sampled from the full 851-pack catalog (see conversation) — real
// material: multi-word phrases, long/short words, both languages.
const RANDOM_PICKS: { wordId: string; lang: 'en' | 'pl' }[] = [
  { wordId: 't1-p860-001', lang: 'pl' }, // Umyślnie
  { wordId: 't1-p363-009', lang: 'pl' }, // Obcy
  { wordId: 't1-p435-012', lang: 'en' }, // Misunderstanding
  { wordId: 't1-p552-013', lang: 'pl' }, // Zmaganie się z czymś
  { wordId: 't1-p503-013', lang: 'pl' }, // Dokładnie
  { wordId: 't1-p776-007', lang: 'en' }, // Cut sb out
  { wordId: 't1-p115-008', lang: 'en' }, // Skillful
  { wordId: 't1-p746-010', lang: 'en' }, // Puzzled
  { wordId: 't1-p669-004', lang: 'pl' }, // Cofać się
  { wordId: 't1-p124-007', lang: 'en' }, // Dawg
  { wordId: 't1-p545-008', lang: 'pl' }, // Łaknienie
  { wordId: 't1-p543-001', lang: 'pl' }, // Kawaler
  { wordId: 't1-p352-003', lang: 'en' }, // Aftermath
  { wordId: 't1-p252-014', lang: 'en' }, // Maid
  { wordId: 't1-p383-007', lang: 'en' }, // Let out
  { wordId: 't1-p243-007', lang: 'en' }, // Park
]

function loadRandomItems(): Item[] {
  const items: Item[] = []
  RANDOM_PICKS.forEach(({ wordId, lang }, i) => {
    const packId = wordId.split('-').slice(0, 2).join('-')
    const pack = JSON.parse(fs.readFileSync(path.join(PACK_DIR, `${packId}.json`), 'utf-8')) as { words: { id: string; english: string; polish: string; polishAudio?: string }[] }
    const word = pack.words.find((w) => w.id === wordId)
    if (!word) { console.error(`Word ${wordId} not found, skipping`); return }
    const text = lang === 'en' ? word.english : (word.polishAudio ?? word.polish)
    const voice = lang === 'en' ? EN_VOICES[i % EN_VOICES.length] : PL_VOICES[i % PL_VOICES.length]
    items.push({ id: wordId.replace(/-/g, ''), lang, text, voiceId: voice.id, voiceName: voice.name })
  })
  return items
}

function withPeriod(text: string): string { return /[.!?;]$/.test(text.trim()) ? text : text.trim() + '.' }

interface ManifestEntry { file: string; wordId: string; lang: string; text: string; voice: string; variant: string }
const manifest: ManifestEntry[] = []

async function generateBaseline(it: Item) {
  const file = `${it.id}__baseline-r2.mp3`
  const outPath = path.join(OUT_DIR, file)
  await ttsPlain(withPeriod(it.text), it.voiceId, it.lang === 'en' ? BASELINE : BASELINE_PL, outPath, `baseline ${it.id}`)
  manifest.push({ file, wordId: it.id, lang: it.lang, text: it.text, voice: it.voiceName, variant: 'baseline' })
}

async function generateCarrierV2(it: Item) {
  const carrierText = CARRIER_TEMPLATES[it.lang](it.text)
  const { buffer, alignment } = await ttsWithTimestamps(carrierText, it.voiceId, CARRIER_SETTINGS, `carrier-v2 ${it.id}`)
  const rawPath = path.join(OUT_DIR, `${it.id}__carrier-v2-raw.mp3`)
  fs.writeFileSync(rawPath, buffer)
  const { startSec, endSec } = extractWordSpan(carrierText, it.text, alignment)
  const file = `${it.id}__carrier-v2.mp3`
  const outPath = path.join(OUT_DIR, file)
  await cutClip(rawPath, outPath, startSec, endSec)
  await postProcessClip(outPath)
  fs.unlinkSync(rawPath)
  manifest.push({ file, wordId: it.id, lang: it.lang, text: it.text, voice: it.voiceName, variant: 'carrier-v2' })
}

async function main() {
  const randomItems = loadRandomItems()
  const total = REPEAT_WORDS.length + randomItems.length * 2
  let done = 0

  for (const it of REPEAT_WORDS) {
    try { await generateCarrierV2(it) } catch (e) { console.error(`\nFailed ${it.id}: ${(e as Error).message}`) }
    done++; process.stdout.write(`\r[${done}/${total}]`)
  }
  for (const it of randomItems) {
    try {
      await generateBaseline(it)
      done++; process.stdout.write(`\r[${done}/${total}]`)
      await generateCarrierV2(it)
      done++; process.stdout.write(`\r[${done}/${total}]`)
    } catch (e) {
      console.error(`\nFailed ${it.id} (${it.text}): ${(e as Error).message}`)
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'manifest-round2.json'), JSON.stringify(manifest, null, 2))
  console.log(`\nDone. ${manifest.length}/${total} clips.`)
}

main()
