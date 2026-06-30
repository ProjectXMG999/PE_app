// Generate audio for demo packs only (t1-p01, t1-p02, t1-p03)
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const PACK_DIR = path.join(ROOT, 'src/data/packs')
const OUT_DIR = path.join(ROOT, 'audio-output')
const API_KEY = process.env.ELEVENLABS_API_KEY || ''

// Alice - Clear, Engaging Educator (premade, available on free tier)
const VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2'
const MODEL_ID = 'eleven_multilingual_v2'

// Demo packs to generate (first 3)
const DEMO_PACKS = ['t1-p01', 't1-p02', 't1-p03']

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY env var not set')
  process.exit(1)
}

interface Word {
  id: string
  english: string
  sentenceEn: string | null
  audioWord: string
  audioSentence: string
}

interface Pack {
  id: string
  name: string
  words: Word[]
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function generateSpeech(text: string, outputPath: string): Promise<void> {
  if (fs.existsSync(outputPath)) {
    return
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
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
        // Rate limited — wait longer
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
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            running--
            next()
          })
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

  const tasks: Promise<void>[] = []

  for (const packId of DEMO_PACKS) {
    const packFile = path.join(PACK_DIR, `${packId}.json`)
    if (!fs.existsSync(packFile)) {
      console.log(`Pack ${packId} not found, skipping`)
      continue
    }
    const pack: Pack = JSON.parse(fs.readFileSync(packFile, 'utf-8'))
    const packOutDir = path.join(OUT_DIR, pack.id)
    console.log(`Queuing ${pack.name}: ${pack.words.length} words`)

    for (const word of pack.words) {
      total++
      tasks.push(limit(async () => {
        try {
          await generateSpeech(word.english, path.join(packOutDir, word.audioWord))
          done++
          process.stdout.write(`\r[${done}/${total}] Word: ${word.english.padEnd(20)}`)
        } catch (e) {
          errors++
          console.error(`\nFailed: "${word.english}" - ${(e as Error).message}`)
        }
      }))

      if (word.sentenceEn) {
        total++
        tasks.push(limit(async () => {
          try {
            await generateSpeech(word.sentenceEn!, path.join(packOutDir, word.audioSentence))
            done++
            process.stdout.write(`\r[${done}/${total}] Sentence for: ${word.english.padEnd(20)}`)
          } catch (e) {
            errors++
            console.error(`\nFailed sentence: "${word.english}" - ${(e as Error).message}`)
          }
        }))
      }
    }
  }

  console.log(`\nGenerating ${total} audio files for packs: ${DEMO_PACKS.join(', ')}`)
  await Promise.all(tasks)
  console.log(`\nDone! Generated: ${done}, Errors: ${errors}`)
  console.log(`Output: ${OUT_DIR}`)
}

main().catch(console.error)
