// One-off: remove pack blobs in Netlify's `packs` store whose id no longer
// exists in src/data/packs (left over from the dedup/reorder fix, which
// dropped 73 pack ids). Safe — packages-index.json (compiled into the app)
// never references them, so they're unreachable clutter, not live data.
import { getStore } from '@netlify/blobs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PACKS_DIR = path.join(ROOT, 'src/data/packs')

const SITE_ID = process.env.NETLIFY_SITE_ID || ''
const AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN || ''
if (!SITE_ID || !AUTH_TOKEN) { console.error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN'); process.exit(1) }

async function main() {
  const store = getStore({ name: 'packs', siteID: SITE_ID, token: AUTH_TOKEN })
  const currentIds = new Set(fs.readdirSync(PACKS_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')))

  const { blobs } = await store.list()
  console.log(`Blobs in "packs" store: ${blobs.length}, current pack files: ${currentIds.size}`)

  const orphans = blobs.filter(b => !currentIds.has(b.key.replace('.json', '')))
  console.log(`Orphaned keys to delete: ${orphans.length}`)
  orphans.forEach(o => console.log('  ' + o.key))

  let deleted = 0
  for (const o of orphans) { await store.delete(o.key); deleted++ }
  console.log(`Deleted: ${deleted}`)
}

main().catch(console.error)
