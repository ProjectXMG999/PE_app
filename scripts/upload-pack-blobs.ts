import { getStore } from '@netlify/blobs'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PACKS_DIR = path.join(ROOT, 'src/data/packs')

const SITE_ID = process.env.NETLIFY_SITE_ID || ''
const AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN || ''

if (!SITE_ID || !AUTH_TOKEN) {
  console.error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN env vars')
  process.exit(1)
}

async function main() {
  const store = getStore({
    name: 'packs',
    siteID: SITE_ID,
    token: AUTH_TOKEN,
  })

  const files = fs.readdirSync(PACKS_DIR).filter(f => f.endsWith('.json'))
  console.log(`Uploading ${files.length} pack files...`)

  let uploaded = 0
  let skipped = 0

  for (const file of files) {
    const data = fs.readFileSync(path.join(PACKS_DIR, file), 'utf-8')

    try {
      await store.set(file, data, { metadata: { contentType: 'application/json' } })
      uploaded++
      if (uploaded % 50 === 0) console.log(`Uploaded: ${uploaded}`)
    } catch (e) {
      console.error(`Failed to upload ${file}:`, e)
      skipped++
    }
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Failed: ${skipped}`)
}

main().catch(console.error)
