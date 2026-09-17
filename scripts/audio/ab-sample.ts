// Etap 0 per docs/voicelab.md: cheap, real, listenable samples so a human
// picks the word-audio approach BEFORE any further mass generation. Only
// WORD audio is tested — sentences already have natural context and sound
// fine with the unchanged production settings.
//
// Variants:
//   baseline  — today's production settings, no post-processing
//   etap1     — stability 0.6, speed 0.8, WITH post-processing (the current
//               pipeline's default)
//   etap1-hi  — stability 0.7, speed 0.8, WITH post-processing
//   carrier   — fraza nośna ("The word is X." / "Słowo: X.") via
//               /with-timestamps, word cut out, WITH post-processing
//
// Usage: npx tsx --env-file=.env scripts/audio/ab-sample.ts
// Output: audio-output/_ab-sample/*.mp3 + manifest.json (no HTML — an
// Artifact page is published separately with these as assets).

import fs from 'fs'
import path from 'path'
import { AUDIO_OUT_DIR } from './lib/config.js'
import { ttsPlain, ttsWithTimestamps } from './lib/elevenLabsClient.js'
import { postProcessClip, cutClip } from './lib/ffmpegPost.js'
import { CARRIER_TEMPLATES, extractWordSpan } from './lib/carrierPhrase.js'
import { PL_VOICES, EN_VOICES, VoiceSettings } from './lib/voicePresets.js'

const OUT_DIR = path.join(AUDIO_OUT_DIR, '_ab-sample')
fs.mkdirSync(OUT_DIR, { recursive: true })

const BASELINE: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 0.75 }
const BASELINE_PL: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true }
const ETAP1: VoiceSettings = { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 0.8 }
const ETAP1_HI: VoiceSettings = { stability: 0.7, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 0.8 }

// Deliberately stress-testing: very short words, a multi-word phrase, normal words.
const WORDS: { id: string; lang: 'en' | 'pl'; text: string; voiceId: string; voiceName: string }[] = [
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

function withPeriod(text: string): string { return /[.!?;]$/.test(text.trim()) ? text : text.trim() + '.' }

interface ManifestEntry { file: string; wordId: string; lang: string; text: string; voice: string; variant: string; settings?: VoiceSettings }
const manifest: ManifestEntry[] = []

async function generateBareVariant(w: typeof WORDS[number], variant: 'baseline' | 'etap1' | 'etap1-hi', settings: VoiceSettings, postProcess: boolean) {
  const file = `${w.id}__${variant}.mp3`
  const outPath = path.join(OUT_DIR, file)
  await ttsPlain(withPeriod(w.text), w.voiceId, settings, outPath, `${variant} ${w.id}`)
  if (postProcess) await postProcessClip(outPath)
  manifest.push({ file, wordId: w.id, lang: w.lang, text: w.text, voice: w.voiceName, variant, settings })
}

async function generateCarrierVariant(w: typeof WORDS[number]) {
  const carrierText = CARRIER_TEMPLATES[w.lang](w.text)
  const settings = ETAP1
  const { buffer, alignment } = await ttsWithTimestamps(carrierText, w.voiceId, settings, `carrier ${w.id}`)
  const rawPath = path.join(OUT_DIR, `${w.id}__carrier-raw.mp3`)
  fs.writeFileSync(rawPath, buffer)
  const { startSec, endSec } = extractWordSpan(carrierText, w.text, alignment)
  const file = `${w.id}__carrier.mp3`
  const outPath = path.join(OUT_DIR, file)
  await cutClip(rawPath, outPath, startSec, endSec)
  await postProcessClip(outPath)
  fs.unlinkSync(rawPath)
  manifest.push({ file, wordId: w.id, lang: w.lang, text: w.text, voice: w.voiceName, variant: 'carrier', settings })
}

async function main() {
  let done = 0
  const total = WORDS.length * 4
  for (const w of WORDS) {
    try {
      await generateBareVariant(w, 'baseline', w.lang === 'en' ? BASELINE : BASELINE_PL, false)
      done++; process.stdout.write(`\r[${done}/${total}]`)
      await generateBareVariant(w, 'etap1', ETAP1, true)
      done++; process.stdout.write(`\r[${done}/${total}]`)
      await generateBareVariant(w, 'etap1-hi', ETAP1_HI, true)
      done++; process.stdout.write(`\r[${done}/${total}]`)
      await generateCarrierVariant(w)
      done++; process.stdout.write(`\r[${done}/${total}]`)
    } catch (e) {
      console.error(`\nFailed on "${w.text}" (${w.lang}): ${(e as Error).message}`)
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\nDone. ${manifest.length}/${total} clips in ${OUT_DIR}`)
}

main()
