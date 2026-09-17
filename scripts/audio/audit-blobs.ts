// Etap 3 pre-flight report, safe to run any time before a generation run:
// lists everything already in the Netlify `audio` blob store and compares it
// to what all 866 pack files expect, so the "generate from scratch" cost
// ceiling can be replaced with a real number. Costs nothing (no ElevenLabs
// calls) — just Netlify Blobs listing + local pack JSON reads.
//
// Usage: npm run audio:audit-blobs -- [--out=path.json]

import { getStore } from '@netlify/blobs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const PACK_DIR = path.join(ROOT, 'src/data/packs')

const SITE_ID = process.env.NETLIFY_SITE_ID || ''
const AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN || ''

if (!SITE_ID || !AUTH_TOKEN) {
  console.error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN env vars')
  process.exit(1)
}

interface Word {
  id: string
  sentenceEn: string | null
  sentencePl: string | null
  audioWord: string
  audioSentence: string
  audioWordPl?: string
  audioSentencePl?: string
}
interface Pack { id: string; words: Word[] }

function expectedKeysForPack(pack: Pack): { key: string; kind: 'en-word' | 'pl-word' | 'en-sentence' | 'pl-sentence' }[] {
  const out: { key: string; kind: 'en-word' | 'pl-word' | 'en-sentence' | 'pl-sentence' }[] = []
  for (const w of pack.words) {
    out.push({ key: `${pack.id}/${w.audioWord}`, kind: 'en-word' })
    out.push({ key: `${pack.id}/${w.audioWordPl ?? `${w.id}-word-pl.mp3`}`, kind: 'pl-word' })
    if (w.sentenceEn) out.push({ key: `${pack.id}/${w.audioSentence}`, kind: 'en-sentence' })
    if (w.sentencePl) out.push({ key: `${pack.id}/${w.audioSentencePl ?? `${w.id}-sentence-pl.mp3`}`, kind: 'pl-sentence' })
  }
  return out
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq === -1) out[arg.slice(2)] = true
    else out[arg.slice(2, eq)] = arg.slice(eq + 1)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const store = getStore({ name: 'audio', siteID: SITE_ID, token: AUTH_TOKEN })

  console.log('Reading pack files...')
  const packFiles = fs.readdirSync(PACK_DIR).filter(f => f.endsWith('.json'))
  const packs: Pack[] = packFiles.map(f => JSON.parse(fs.readFileSync(path.join(PACK_DIR, f), 'utf-8')))

  const expected = new Map<string, 'en-word' | 'pl-word' | 'en-sentence' | 'pl-sentence'>()
  for (const pack of packs) {
    for (const { key, kind } of expectedKeysForPack(pack)) expected.set(key, kind)
  }
  console.log(`Expected keys across ${packs.length} packs: ${expected.size}`)

  console.log('Listing existing blobs in store "audio" (this can take a while for tens of thousands of keys)...')
  const present = new Map<string, number>() // key -> size in bytes
  let cursor: string | undefined
  let pages = 0
  do {
    const { blobs, cursor: next } = await store.list({ cursor })
    for (const b of blobs) present.set(b.key, (b as unknown as { size?: number }).size ?? -1)
    cursor = next
    pages++
    process.stdout.write(`\r  listed ${present.size} keys (page ${pages})`)
  } while (cursor)
  console.log(`\nTotal blobs in store: ${present.size}`)

  const byKind: Record<string, { expected: number; present: number; missing: number; suspiciouslySmall: number }> = {}
  const missing: string[] = []
  const suspiciouslySmall: string[] = []
  const SMALL_THRESHOLD_BYTES = 300 // a valid mp3, even a short word, should be well above this

  for (const [key, kind] of expected) {
    byKind[kind] ??= { expected: 0, present: 0, missing: 0, suspiciouslySmall: 0 }
    byKind[kind].expected++
    const size = present.get(key)
    if (size === undefined) {
      byKind[kind].missing++
      missing.push(key)
    } else {
      byKind[kind].present++
      if (size >= 0 && size < SMALL_THRESHOLD_BYTES) {
        byKind[kind].suspiciouslySmall++
        suspiciouslySmall.push(`${key} (${size}B)`)
      }
    }
  }

  const unexpected = [...present.keys()].filter(k => !expected.has(k) && !k.startsWith('intro-'))

  console.log('\n=== AUDIO BLOB AUDIT ===\n')
  for (const [kind, s] of Object.entries(byKind)) {
    console.log(`${kind.padEnd(14)} expected ${String(s.expected).padStart(6)}  present ${String(s.present).padStart(6)}  missing ${String(s.missing).padStart(6)}  suspiciously-small ${s.suspiciouslySmall}`)
  }
  console.log(`\nTotal missing: ${missing.length}`)
  console.log(`Total suspiciously small (<${SMALL_THRESHOLD_BYTES}B): ${suspiciouslySmall.length}`)
  console.log(`Blobs present but not expected by any pack (orphans, excluding intro-*): ${unexpected.length}`)

  if (args.out) {
    const outPath = path.resolve(ROOT, String(args.out))
    fs.writeFileSync(outPath, JSON.stringify({ byKind, missing, suspiciouslySmall, unexpected }, null, 2))
    console.log(`\nFull report written to ${path.relative(ROOT, outPath)}`)
  } else {
    console.log('\nPass --out=path.json to save the full missing/suspicious/orphan lists.')
  }
}

main().catch(console.error)
