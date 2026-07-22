import { getStore } from '@netlify/blobs'
import * as fs from 'fs'
import * as path from 'path'

const SITE_ID = process.env.NETLIFY_SITE_ID || ''
const AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN || ''

const failedKeys = [
  't1-p065/t1-p065-008-word.mp3',
  't1-p065/t1-p065-010-word.mp3',
  't1-p066/t1-p066-006-word-pl.mp3',
]

async function main() {
  const store = getStore({ name: 'audio', siteID: SITE_ID, token: AUTH_TOKEN })
  for (const key of failedKeys) {
    const filePath = path.join(process.cwd(), 'audio-output', key)
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP (missing locally): ${key}`)
      continue
    }
    const data = fs.readFileSync(filePath)
    try {
      await store.set(key, data, { metadata: { contentType: 'audio/mpeg' } })
      console.log(`OK: ${key}`)
    } catch (e) {
      console.error(`STILL FAILED: ${key}`, e)
    }
  }
}

main().catch(console.error)
