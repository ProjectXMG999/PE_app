// Generate EN + PL audio for specified packs with alternating voices
// PL rotation (per word, mod 4): Piotr(M) → Magdalena(F) → Pawel(M) → Violetta(F) → repeat
// EN rotation (per word, mod 4): Adam US(M) → Samantha US(F) → William UK(M) → Tamsin UK(F) → repeat

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PACK_DIR = path.join(ROOT, 'src/data/packs')
const OUT_DIR = path.join(ROOT, 'audio-output')
const API_KEY = process.env.ELEVENLABS_API_KEY || ''
const MODEL_ID = 'eleven_multilingual_v2'

// Packs to generate — change this list to target different packs
const TARGET_PACKS = ['t1-p01','t1-p02','t1-p03','t1-p04','t1-p05','t1-p06',
                      't1-p07','t1-p08','t1-p09','t1-p10','t1-p11','t1-p12']

const PL_VOICES = [
  { id: 'o2xdfKUpc1Bwq7RchZuW', name: 'Piotr',    gender: 'M' },
  { id: 'N0GCuK2B0qwWozQNTS8F', name: 'Magdalena', gender: 'F' },
  { id: 'zzBTsLBFM6AOJtkr1e9b', name: 'Pawel',     gender: 'M' },
  { id: 'gfKKsLN1k0oYYN9n2dXX', name: 'Violetta',  gender: 'F' },
]

const EN_VOICES = [
  { id: 'wBXNqKUATyqu0RtYt25i', name: 'Adam',     accent: 'US',  gender: 'M' },
  { id: 'uIZsnBL0YK1S5j69bAih', name: 'Samantha', accent: 'US',  gender: 'F' },
  { id: 'fjnwTZkKtQOJaYzGLa6n', name: 'William',  accent: 'UK',  gender: 'M' },
  { id: 'dAlhI9qAHVIjXuVppzhW', name: 'Tamsin',   accent: 'UK',  gender: 'F' },
]

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY env var not set')
  process.exit(1)
}

interface Word {
  id: string
  english: string
  polish: string
  sentenceEn: string | null
  sentencePl: string | null
  audioWord: string
  audioSentence: string
  audioWordPl?: string
  audioSentencePl?: string
}
interface Pack { id: string; name: string; words: Word[] }

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function generateSpeech(text: string, voiceId: string, outputPath: string, speed = 1.0): Promise<void> {
  if (fs.existsSync(outputPath)) return

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body: Record<string, unknown> = {
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }
      if (speed !== 1.0) {
        (body.voice_settings as Record<string, unknown>).speed = speed
      }

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
          body: JSON.stringify(body),
        }
      )

      if (response.status === 429) { await sleep(5000 * (attempt + 1)); continue }

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`ElevenLabs ${response.status}: ${err.slice(0, 200)}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, buffer)
      return
    } catch (e) {
      if (attempt === 2) throw e
      await sleep(2000 * (attempt + 1))
    }
  }
}

function createLimiter(concurrency: number) {
  let running = 0
  const queue: (() => void)[] = []
  function next() {
    while (running < concurrency && queue.length > 0) { running++; queue.shift()!() }
  }
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push(() => { fn().then(resolve).catch(reject).finally(() => { running--; next() }) })
      next()
    })
  }
}

async function main() {
  const limit = createLimiter(3)
  let total = 0, done = 0, errors = 0
  let wordIndex = 0

  const tasks: Promise<void>[] = []

  for (const packId of TARGET_PACKS) {
    const packFile = path.join(PACK_DIR, `${packId}.json`)
    if (!fs.existsSync(packFile)) { console.log(`Pack ${packId} not found, skipping`); continue }

    const pack: Pack = JSON.parse(fs.readFileSync(packFile, 'utf-8'))
    const packOutDir = path.join(OUT_DIR, pack.id)
    console.log(`Queuing ${pack.id} – ${pack.name}: ${pack.words.length} words`)

    for (const word of pack.words) {
      const wi = wordIndex
      const plVoice = PL_VOICES[wi % PL_VOICES.length]
      const enVoice = EN_VOICES[wi % EN_VOICES.length]
      wordIndex++

      // EN word
      total++
      tasks.push(limit(async () => {
        try {
          await generateSpeech(word.english, enVoice.id, path.join(packOutDir, word.audioWord), 0.75)
          done++
          process.stdout.write(`\r[${done}/${total}] EN word: ${word.english.slice(0,20).padEnd(20)} (${enVoice.name} ${enVoice.accent})`)
        } catch (e) { errors++; console.error(`\nFailed EN word: "${word.english}" – ${(e as Error).message}`) }
      }))

      // EN sentence
      if (word.sentenceEn) {
        total++
        tasks.push(limit(async () => {
          try {
            await generateSpeech(word.sentenceEn!, enVoice.id, path.join(packOutDir, word.audioSentence), 0.75)
            done++
            process.stdout.write(`\r[${done}/${total}] EN sent: ${word.english.slice(0,20).padEnd(20)} (${enVoice.name} ${enVoice.accent})`)
          } catch (e) { errors++; console.error(`\nFailed EN sentence: "${word.english}" – ${(e as Error).message}`) }
        }))
      }

      // PL word
      const plFile = `${word.id}-word-pl.mp3`
      total++
      tasks.push(limit(async () => {
        try {
          await generateSpeech(word.polish, plVoice.id, path.join(packOutDir, plFile))
          done++
          process.stdout.write(`\r[${done}/${total}] PL word: ${word.polish.slice(0,20).padEnd(20)} (${plVoice.name})`)
        } catch (e) { errors++; console.error(`\nFailed PL word: "${word.polish}" – ${(e as Error).message}`) }
      }))

      // PL sentence
      if (word.sentencePl) {
        const plSentFile = `${word.id}-sentence-pl.mp3`
        total++
        tasks.push(limit(async () => {
          try {
            await generateSpeech(word.sentencePl!, plVoice.id, path.join(packOutDir, plSentFile))
            done++
            process.stdout.write(`\r[${done}/${total}] PL sent: ${word.polish.slice(0,20).padEnd(20)} (${plVoice.name})`)
          } catch (e) { errors++; console.error(`\nFailed PL sentence: "${word.polish}" – ${(e as Error).message}`) }
        }))
      }
    }
  }

  console.log(`\nStarting: ${total} audio files for ${TARGET_PACKS.join(', ')}`)
  await Promise.all(tasks)
  console.log(`\nDone! Generated: ${done}, Errors: ${errors}, Skipped (exist): ${total - done - errors}`)

  // Update pack JSONs with Polish audio filenames
  console.log('\nUpdating pack JSON files...')
  wordIndex = 0
  for (const packId of TARGET_PACKS) {
    const packFile = path.join(PACK_DIR, `${packId}.json`)
    if (!fs.existsSync(packFile)) continue
    const pack: Pack = JSON.parse(fs.readFileSync(packFile, 'utf-8'))
    for (const word of pack.words) {
      word.audioWordPl = `${word.id}-word-pl.mp3`
      if (word.sentencePl) word.audioSentencePl = `${word.id}-sentence-pl.mp3`
      wordIndex++
    }
    fs.writeFileSync(packFile, JSON.stringify(pack, null, 2))
    console.log(`  Updated ${packId}.json`)
  }

  // Sync updated packs to public/
  console.log('\n--- Syncing to public/ ---')
  const PUBLIC_PACK_DIR = path.join(ROOT, 'public/data/packs')
  for (const packId of TARGET_PACKS) {
    const src = path.join(PACK_DIR, `${packId}.json`)
    const dest = path.join(PUBLIC_PACK_DIR, `${packId}.json`)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      console.log(`  Synced ${packId}.json → public/data/packs/`)
    }
  }

  console.log('Done. Run: npm run upload-audio-blobs')
}

main().catch(console.error)
