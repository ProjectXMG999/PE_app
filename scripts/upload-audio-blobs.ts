import { getStore } from '@netlify/blobs'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const AUDIO_DIR = path.join(ROOT, 'audio-output')

const SITE_ID = process.env.NETLIFY_SITE_ID || ''
const AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN || ''

if (!SITE_ID || !AUTH_TOKEN) {
  console.error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN env vars')
  process.exit(1)
}

async function main() {
  const store = getStore({
    name: 'audio',
    siteID: SITE_ID,
    token: AUTH_TOKEN,
  })

  const packDirs = fs.readdirSync(AUDIO_DIR).filter(d =>
    fs.statSync(path.join(AUDIO_DIR, d)).isDirectory()
  )

  let uploaded = 0
  let skipped = 0

  for (const packId of packDirs) {
    const packDir = path.join(AUDIO_DIR, packId)
    const files = fs.readdirSync(packDir).filter(f => f.endsWith('.mp3'))
    console.log(`Uploading ${files.length} files for ${packId}...`)

    for (const file of files) {
      const key = `${packId}/${file}`
      const data = fs.readFileSync(path.join(packDir, file))

      try {
        await store.set(key, data, { metadata: { contentType: 'audio/mpeg' } })
        uploaded++
        if (uploaded % 50 === 0) console.log(`Uploaded: ${uploaded}`)
      } catch (e) {
        console.error(`Failed to upload ${key}:`, e)
        skipped++
      }
    }
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Failed: ${skipped}`)
}

main().catch(console.error)
