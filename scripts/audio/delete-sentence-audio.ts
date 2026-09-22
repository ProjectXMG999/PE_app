// Full reset of sentence audio per explicit user request: existing sentence
// clips (both EN and PL, across every level) come from a mix of an old
// pipeline (wrong/unwanted voices, some stale text) and a newer one that,
// while text-correct, still used the same over-aggressive silence trim that
// clips real trailing sound (see generate-packs.ts's postProcessClip fix).
// Rather than trying to distinguish "good enough" from "bad" clip by clip,
// delete every sentence blob and regenerate the whole catalog fresh with
// the corrected settings and voice roster.
//
// Deletes ONLY *-sentence.mp3 / *-sentence-pl.mp3 keys — word audio is
// untouched. Also clears local sentence files, checkpoint sentence
// entries, and unsets every sentenceAudio flag so the app stops
// referencing deleted audio immediately (before regeneration catches up).
//
// Usage: npx tsx --env-file=.env scripts/audio/delete-sentence-audio.ts --write

import { getStore } from '@netlify/blobs'
import fs from 'fs'
import path from 'path'
import { PACK_DIR, AUDIO_OUT_DIR, ROOT } from './lib/config.js'

const WRITE = process.argv.includes('--write')
const SITE_ID = process.env.NETLIFY_SITE_ID || ''
const AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN || ''

async function main() {
  if (!SITE_ID || !AUTH_TOKEN) { console.error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN'); process.exit(1) }
  const store = getStore({ name: 'audio', siteID: SITE_ID, token: AUTH_TOKEN })

  console.log('Listing remote audio blobs...')
  const sentenceKeys: string[] = []
  let cursor: string | undefined
  do {
    const { blobs, cursor: next } = await store.list({ cursor })
    for (const b of blobs) if (/-sentence(-pl)?\.mp3$/.test(b.key)) sentenceKeys.push(b.key)
    cursor = next
  } while (cursor)
  console.log(`Remote sentence blobs found: ${sentenceKeys.length}`)

  if (WRITE) {
    let deleted = 0
    for (const key of sentenceKeys) {
      await store.delete(key)
      deleted++
      if (deleted % 200 === 0) console.log(`  deleted ${deleted}/${sentenceKeys.length}`)
    }
    console.log(`Deleted ${deleted} remote sentence blobs.`)
  } else {
    console.log('(dry run — remote blobs not deleted)')
  }

  // local files
  let localDeleted = 0
  if (fs.existsSync(AUDIO_OUT_DIR)) {
    for (const dir of fs.readdirSync(AUDIO_OUT_DIR)) {
      if (dir.startsWith('_')) continue
      const packDir = path.join(AUDIO_OUT_DIR, dir)
      if (!fs.statSync(packDir).isDirectory()) continue
      for (const f of fs.readdirSync(packDir)) {
        if (/-sentence(-pl)?\.mp3$/.test(f)) {
          if (WRITE) fs.unlinkSync(path.join(packDir, f))
          localDeleted++
        }
      }
    }
  }
  console.log(`Local sentence files ${WRITE ? 'deleted' : 'found'}: ${localDeleted}`)

  // checkpoint: drop en-sentence/pl-sentence entries
  const checkpointPath = path.join(ROOT, 'audio-output/_reports/checkpoint.jsonl')
  if (fs.existsSync(checkpointPath)) {
    const lines = fs.readFileSync(checkpointPath, 'utf-8').trim().split('\n').filter(Boolean)
    const kept = lines.filter((l) => {
      const r = JSON.parse(l)
      return r.kind !== 'en-sentence' && r.kind !== 'pl-sentence'
    })
    console.log(`Checkpoint: ${lines.length} lines -> ${kept.length} after dropping sentence entries`)
    if (WRITE) fs.writeFileSync(checkpointPath, kept.join('\n') + '\n')
  }

  // unset sentenceAudio flags everywhere
  const packFiles = fs.readdirSync(PACK_DIR).filter((f) => f.endsWith('.json'))
  let unflagged = 0
  for (const f of packFiles) {
    const packPath = path.join(PACK_DIR, f)
    const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8')) as { words: { sentenceAudio?: boolean }[] }
    let changed = false
    for (const w of pack.words) {
      if (w.sentenceAudio) { w.sentenceAudio = false; changed = true; unflagged++ }
    }
    if (changed && WRITE) fs.writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n')
  }
  console.log(`sentenceAudio flags unset: ${unflagged}`)
  if (!WRITE) console.log('\nDry run — pass --write to actually delete/unset.')
}

main().catch(console.error)
