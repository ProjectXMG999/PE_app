// One-off repair: `sentenceAudio` was only ever set true by generate-packs.ts
// for a word whose EN+PL sentence clips were freshly (re)confirmed in THAT
// run — but a sentence clip already present in the Netlify blob store from
// before this pipeline existed is deliberately skipped (no reason to re-pay
// for it), so it never passed through the flag-writing step. Net effect:
// hundreds of words (984 in Level 1 alone) have real, correct sentence
// audio sitting in the blob store that the app never plays, because
// useAudio.ts gates playback on this flag.
//
// This script costs no API calls: it only reads the latest blob audit
// (npm run audio:audit-blobs) and flips the flag for any word whose
// EN+PL sentence clips are both present remotely and not suspiciously
// small (the audit's own corruption heuristic).
//
// Usage: npx tsx scripts/audio/fix-sentence-audio-flags.ts [--write]

import fs from 'fs'
import path from 'path'
import { PACK_DIR, ROOT } from './lib/config.js'

const WRITE = process.argv.includes('--write')
const AUDIT_PATH = path.join(ROOT, 'audio-output/_reports/blob-audit.json')

interface Word {
  id: string
  sentenceEn: string | null
  sentencePl: string | null
  audioSentence: string
  audioSentencePl?: string
  sentenceAudio?: boolean
}
interface Pack { id: string; words: Word[] }

function main() {
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf-8')) as { missing: string[]; suspiciouslySmall: string[] }
  const missing = new Set(audit.missing)
  const small = new Set(audit.suspiciouslySmall.map((s) => s.replace(/ \(\d+B\)$/, '')))
  const bad = (key: string) => missing.has(key) || small.has(key)

  const packFiles = fs.readdirSync(PACK_DIR).filter((f) => f.endsWith('.json'))
  let checked = 0, alreadyTrue = 0, newlyFixed = 0, stillMissing = 0
  const fixedByLevel = new Map<number, number>()

  for (const f of packFiles) {
    const packPath = path.join(PACK_DIR, f)
    const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8')) as Pack & { level: number }
    let changed = false
    for (const w of pack.words) {
      const needsEn = !!w.sentenceEn
      const needsPl = !!w.sentencePl
      if (!needsEn && !needsPl) continue
      checked++
      if (w.sentenceAudio) { alreadyTrue++; continue }

      const enKey = `${pack.id}/${w.audioSentence}`
      const plKey = `${pack.id}/${w.audioSentencePl ?? `${w.id}-sentence-pl.mp3`}`
      const enOk = !needsEn || !bad(enKey)
      const plOk = !needsPl || !bad(plKey)

      if (enOk && plOk) {
        w.sentenceAudio = true
        changed = true
        newlyFixed++
        fixedByLevel.set(pack.level, (fixedByLevel.get(pack.level) ?? 0) + 1)
      } else {
        stillMissing++
      }
    }
    if (changed && WRITE) fs.writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n')
  }

  console.log(`Sentenced words checked: ${checked}`)
  console.log(`Already flagged true: ${alreadyTrue}`)
  console.log(`Newly fixed (audio present, flag was false): ${newlyFixed}`)
  console.log(`Still missing audio (flag correctly stays false): ${stillMissing}`)
  console.log('By level:', Object.fromEntries(fixedByLevel))
  if (!WRITE) console.log('\nDry run — pass --write to save changes.')
}

main()
