// Generate training-intro.mp3 using Piotr (PL voice)
// Output: public/audio/training-intro.mp3

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public/audio')
const API_KEY = process.env.ELEVENLABS_API_KEY || ''
const MODEL_ID = 'eleven_multilingual_v2'
const PIOTR_VOICE_ID = 'o2xdfKUpc1Bwq7RchZuW'

export const TRAINING_PARAGRAPHS = [
  'Cześć. Wchodzisz właśnie do zakładki Trening.',
  'Tu nie chodzi o to, żeby przeklikać jak najwięcej słówek. Tu chodzi o jedno: żebyś zaczął naprawdę mówić. Dlatego mamy cztery ćwiczenia i każde z nich robi coś konkretnego.',
  'Pierwsze to Słowo w Akcji. Widzisz słowo i od razu budujesz z nim krótkie frazy na głos. Uczysz mózg, że to słowo działa. Że potrafisz go użyć. Że nie musisz się go bać.',
  'Drugie to Moje Zdanie. Tworzysz zdanie z własnego życia. Nie z podręcznika, nie wymyślone — swoje. Mózg zapamiętuje to, co jest dla niego osobiste i konkretne.',
  'Trzecie to Jedno Słowo, Trzy Dziedziny. Bierzesz jedno słowo i używasz go w trzech różnych sytuacjach — w domu, w pracy, w codziennym życiu. To właśnie tak działa prawdziwy język.',
  'Czwarte to Drabina Zdania. Zaczynasz od prostego zdania i rozwijasz je krok po kroku. Uczysz się mówić więcej, pełniej, swobodniej.',
  'Każde ćwiczenie to inny rodzaj treningu. Razem tworzą system, który naprawdę działa.',
  'Wybierz ćwiczenie i zacznij. Mały krok. Codziennie.',
]

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY env var not set')
  process.exit(1)
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function generateParagraph(text: string, index: number, total: number): Promise<Buffer> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${PIOTR_VOICE_ID}`,
        {
          method: 'POST',
          headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
          body: JSON.stringify({
            text,
            model_id: MODEL_ID,
            voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
          }),
        }
      )
      if (response.status === 429) { await sleep(5000 * (attempt + 1)); continue }
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`ElevenLabs ${response.status}: ${err.slice(0, 200)}`)
      }
      process.stdout.write(`\r  [${index + 1}/${total}] OK`)
      return Buffer.from(await response.arrayBuffer())
    } catch (e) {
      if (attempt === 2) throw e
      await sleep(2000 * (attempt + 1))
    }
  }
  throw new Error('unreachable')
}

async function main() {
  console.log(`\nGenerating training-intro (${TRAINING_PARAGRAPHS.length} paragraphs)...`)
  const chunks: Buffer[] = []
  for (let i = 0; i < TRAINING_PARAGRAPHS.length; i++) {
    chunks.push(await generateParagraph(TRAINING_PARAGRAPHS[i], i, TRAINING_PARAGRAPHS.length))
    await sleep(300)
  }
  const combined = Buffer.concat(chunks)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outPath = path.join(OUT_DIR, 'training-intro.mp3')
  fs.writeFileSync(outPath, combined)
  console.log(`\n  Saved: ${outPath} (${(combined.length / 1024).toFixed(1)} KB)`)
  console.log('\nDone!')
}

main().catch(console.error)
