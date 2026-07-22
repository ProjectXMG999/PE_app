// Usuwa z audio-output/ pliki mp3, które nie odpowiadają żadnemu słowu
// w aktualnych paczkach (src/data/packs). Sieroty pochodzą ze starej,
// większej struktury paczek sprzed podziału na 10-słowne.
//
// Użycie:
//   node scripts/clean-audio-output.mjs           # dry-run: tylko raport
//   node scripts/clean-audio-output.mjs --apply   # faktyczne usunięcie
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const AUDIO_DIR = path.join(ROOT, 'audio-output')
const PACKS_DIR = path.join(ROOT, 'src/data/packs')

const apply = process.argv.includes('--apply')

const expected = new Set()
for (const f of fs.readdirSync(PACKS_DIR).filter(f => f.endsWith('.json'))) {
  const pack = JSON.parse(fs.readFileSync(path.join(PACKS_DIR, f), 'utf8'))
  for (const w of pack.words) {
    if (w.audioWord) expected.add(`${pack.id}/${w.audioWord}`)
    if (w.audioWordPl) expected.add(`${pack.id}/${w.audioWordPl}`)
    if (w.audioSentence) expected.add(`${pack.id}/${w.audioSentence}`)
    if (w.audioSentencePl) expected.add(`${pack.id}/${w.audioSentencePl}`)
  }
}

let kept = 0
let orphans = 0
const orphanSample = []
for (const dir of fs.readdirSync(AUDIO_DIR)) {
  const dirPath = path.join(AUDIO_DIR, dir)
  if (!fs.statSync(dirPath).isDirectory()) continue
  for (const file of fs.readdirSync(dirPath).filter(f => f.endsWith('.mp3'))) {
    if (expected.has(`${dir}/${file}`)) {
      kept++
      continue
    }
    orphans++
    if (orphanSample.length < 10) orphanSample.push(`${dir}/${file}`)
    if (apply) fs.unlinkSync(path.join(dirPath, file))
  }
  if (apply && fs.readdirSync(dirPath).length === 0) fs.rmdirSync(dirPath)
}

console.log(`Matching current packs: ${kept}`)
console.log(`Orphans ${apply ? 'DELETED' : 'found (dry-run, nothing deleted)'}: ${orphans}`)
if (orphanSample.length) console.log(`Sample: ${orphanSample.join(', ')}${orphans > 10 ? ', …' : ''}`)
if (!apply && orphans > 0) console.log('\nRun with --apply to delete them.')
