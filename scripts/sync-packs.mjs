// Sync src/data/packs/ → public/data/packs/ after parse-data or match-sentences
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC_PACKS = path.join(ROOT, 'src/data/packs')
const PUB_PACKS = path.join(ROOT, 'public/data/packs')
const SRC_INDEX = path.join(ROOT, 'src/data/packages-index.json')
const PUB_INDEX = path.join(ROOT, 'public/data/packages-index.json')

fs.mkdirSync(PUB_PACKS, { recursive: true })
const files = fs.readdirSync(SRC_PACKS).filter(f => f.endsWith('.json'))
for (const f of files) {
  fs.copyFileSync(path.join(SRC_PACKS, f), path.join(PUB_PACKS, f))
}
fs.copyFileSync(SRC_INDEX, PUB_INDEX)
console.log(`Synced ${files.length} packs to public/data/packs/`)
