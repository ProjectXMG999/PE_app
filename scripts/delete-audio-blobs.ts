// Delete all audio blobs from Netlify store (pack audio only — intro files are in public/audio/, not blobs)
import { getStore } from '@netlify/blobs'

const SITE_ID = process.env.NETLIFY_SITE_ID || ''
const AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN || ''

if (!SITE_ID || !AUTH_TOKEN) {
  console.error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN env vars')
  process.exit(1)
}

async function main() {
  const store = getStore({ name: 'audio', siteID: SITE_ID, token: AUTH_TOKEN })

  console.log('Listing all blobs...')
  const { blobs } = await store.list()
  console.log(`Found ${blobs.length} blobs`)

  if (blobs.length === 0) {
    console.log('Nothing to delete.')
    return
  }

  let deleted = 0
  let skipped = 0

  for (const blob of blobs) {
    if (blob.key.startsWith('intro-')) {
      console.log(`  Skipping: ${blob.key}`)
      skipped++
      continue
    }
    await store.delete(blob.key)
    deleted++
    if (deleted % 50 === 0) process.stdout.write(`\r  Deleted: ${deleted}/${blobs.length - skipped}`)
  }

  console.log(`\nDone! Deleted: ${deleted}, Skipped: ${skipped}`)
}

main().catch(console.error)
