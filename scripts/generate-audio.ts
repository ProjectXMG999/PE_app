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
  words: Word[]
}

async function generateSpeech(text: string, outputPath: string): Promise<void> {
  if (fs.existsSync(outputPath)) {
    return // already generated
  }

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

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`ElevenLabs error ${response.status}: ${err}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, buffer)
}

// Concurrency limiter
function createLimiter(concurrency: number) {
  let running = 0
  const queue: (() => void)[] = []

  function next() {
    if (running < concurrency && queue.length > 0) {
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
  const packFiles = fs.readdirSync(PACK_DIR).filter(f => f.endsWith('.json'))

  let total = 0
  let done = 0
  let errors = 0

  const tasks: Promise<void>[] = []

  for (const file of packFiles) {
    const pack: Pack = JSON.parse(fs.readFileSync(path.join(PACK_DIR, file), 'utf-8'))
    const packOutDir = path.join(OUT_DIR, pack.id)

    for (const word of pack.words) {
      total += 2

      tasks.push(limit(async () => {
        const wordPath = path.join(packOutDir, word.audioWord)
        try {
          await generateSpeech(word.english, wordPath)
          done++
          if (done % 20 === 0) console.log(`Progress: ${done}/${total}`)
        } catch (e) {
          errors++
          console.error(`Failed word "${word.english}":`, e)
          // Exponential backoff retry
          await new Promise(r => setTimeout(r, 2000))
          try {
            await generateSpeech(word.english, wordPath)
            done++
          } catch {
            console.error(`Retry failed for "${word.english}"`)
          }
        }
      }))

      if (word.sentenceEn) {
        tasks.push(limit(async () => {
          const sentPath = path.join(packOutDir, word.audioSentence)
          try {
            await generateSpeech(word.sentenceEn!, sentPath)
            done++
            if (done % 20 === 0) console.log(`Progress: ${done}/${total}`)
          } catch (e) {
            errors++
            console.error(`Failed sentence for "${word.english}":`, e)
          }
        }))
      } else {
        total--
      }
    }
  }

  console.log(`Generating ${total} audio files...`)
  await Promise.all(tasks)
  console.log(`\nDone! Generated: ${done}, Errors: ${errors}`)
  console.log(`Output: ${OUT_DIR}`)
}

main().catch(console.error)
