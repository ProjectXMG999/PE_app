// Sync src/data/packages-index.json → public/data/packages-index.json after parse-data or match-sentences.
// Pack CONTENT (word/sentence data) is intentionally NOT copied to public/ — it's paywalled,
// served only via the authenticated pack-content Netlify Function (see scripts/upload-pack-blobs.ts).
// The index has metadata only (id/name/level/category/wordCount), safe to stay public.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC_INDEX = path.join(ROOT, 'src/data/packages-index.json')
const PUB_INDEX = path.join(ROOT, 'public/data/packages-index.json')

fs.mkdirSync(path.dirname(PUB_INDEX), { recursive: true })
fs.copyFileSync(SRC_INDEX, PUB_INDEX)
console.log('Synced packages-index.json')
