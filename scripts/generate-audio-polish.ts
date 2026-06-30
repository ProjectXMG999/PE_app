// Generate Polish audio for demo packs using 3 rotating Polish voices
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const PACK_DIR = path.join(ROOT, 'src/data/packs')
const OUT_DIR = path.join(ROOT, 'audio-output')
const API_KEY = process.env.ELEVENLABS_API_KEY || ''
const MODEL_ID = 'eleven_multilingual_v2'

const DEMO_PACKS = ['t1-p01', 't1-p02', 't1-p03']

// 3 Polish voices from Voice Library (requires paid plan)
const POLISH_VOICES = [
  { id: 'N0GCuK2B0qwWozQNTS8F', name: 'Magdalena' },
  { id: 'o2xdfKUpc1Bwq7RchZuW', name: 'Piotr' },
  { id: 'd4Z5Fvjohw3zxGpV8XUV', name: 'Maria' },
]

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY env var not set')
  process.exit(1)
}

interface Word {
  id: string
  polish: string
  sentencePl: string | null
  audioWordPl?: string
  audioSentencePl?: string
}

interface Pack {
  id: string
  name: string
  words: Word[]
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function generateSpeech(text: string, voiceId: string, outputPath: string): Promise<void> {
  if (fs.existsSync(outputPath)) return

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: MODEL_ID,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              style: 0.2,
              use_speaker_boost: true,
            },
          }),
        }
      )

      if (response.status === 429) {
        await sleep(5000 * (attempt + 1))
        continue
      }

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
    while (running < concurrency && queue.length > 0) {
      running++
      queue.shift()!()
    }
  }
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push(() => {
        fn().then(resolve).catch(reject).finally(() => { running--; next() })
      })
      next()
    })
  }
}

async function main() {
  const limit = createLimiter(3)
  let total = 0
  let done = 0
  let errors = 0
  let wordIndex = 0

  const tasks: Promise<void>[] = []

  for (const packId of DEMO_PACKS) {
    const packFile = path.join(PACK_DIR, `${packId}.json`)
    if (!fs.existsSync(packFile)) { console.log(`Pack ${packId} not found, skipping`); continue }

    const pack: Pack = JSON.parse(fs.readFileSync(packFile, 'utf-8'))
    const packOutDir = path.join(OUT_DIR, pack.id)
    console.log(`Queuing ${pack.name}: ${pack.words.length} words`)

    for (const word of pack.words) {
      const voice = POLISH_VOICES[wordIndex % POLISH_VOICES.length]
      wordIndex++

      const wordPlFile = `${word.id}-word-pl.mp3`
      total++
      tasks.push(limit(async () => {
        try {
          await generateSpeech(word.polish, voice.id, path.join(packOutDir, wordPlFile))
          done++
          process.stdout.write(`\r[${done}/${total}] PL word: ${word.polish.padEnd(20)} (${voice.name})`)
        } catch (e) {
          errors++
          console.error(`\nFailed word PL: "${word.polish}" - ${(e as Error).message}`)
        }
      }))

      if (word.sentencePl) {
        const sentencePlFile = `${word.id}-sentence-pl.mp3`
        total++
        tasks.push(limit(async () => {
          try {
            await generateSpeech(word.sentencePl!, voice.id, path.join(packOutDir, sentencePlFile))
            done++
            process.stdout.write(`\r[${done}/${total}] PL sentence: ${word.polish.padEnd(20)} (${voice.name})`)
          } catch (e) {
            errors++
            console.error(`\nFailed sentence PL: "${word.polish}" - ${(e as Error).message}`)
          }
        }))
      }
    }
  }

  console.log(`\nGenerating ${total} Polish audio files...`)
  await Promise.all(tasks)
  console.log(`\nDone! Generated: ${done}, Errors: ${errors}`)

  // Update pack JSONs with Polish audio filenames
  console.log('\nUpdating pack JSON files with Polish audio fields...')
  wordIndex = 0
  for (const packId of DEMO_PACKS) {
    const packFile = path.join(PACK_DIR, `${packId}.json`)
    if (!fs.existsSync(packFile)) continue
    const pack = JSON.parse(fs.readFileSync(packFile, 'utf-8'))
    for (const word of pack.words) {
      word.audioWordPl = `${word.id}-word-pl.mp3`
      if (word.sentencePl) {
        word.audioSentencePl = `${word.id}-sentence-pl.mp3`
      }
      wordIndex++
    }
    fs.writeFileSync(packFile, JSON.stringify(pack, null, 2))
    console.log(`Updated ${packId}.json`)
  }
  console.log('Pack JSONs updated. Run: npm run sync-packs')
}

main().catch(console.error)
