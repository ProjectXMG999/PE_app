// Replace every example sentence in src/data/packs/*.json with the final
// picks from a master review sheet ("Wybrane PL" / "Wybrane ENG" — the
// owner's pick where he made one, otherwise the AI's), for words up to a
// given Lp position. Every other word ends up with no sentence.
//
// Sentence audio is switched off for every word (`sentenceAudio` removed):
// the recordings in the audio store were made for the old sentences and
// keep their file names, so they must not play under the new text. Audio
// file names are left in place for a later re-record, which should set
// `sentenceAudio: true` on the words it actually records.
//
// The app reads packs from Netlify Blobs, not from this folder — run
// `npm run upload-pack-blobs` afterwards to publish.
//
// Usage:
//   npm run gen-sentences:apply-master -- --dry-run
//   npm run gen-sentences:apply-master -- --source=database/database/candidates-master-v5.xlsx --to=3000

import fs from 'fs'
import path from 'path'
import { ROOT } from './sentences/lib/config.js'
import { loadPackFiles } from './sentences/lib/wordSource.js'
import { loadMaster, wordRowsByLp } from './sentences/lib/masterSheet.js'

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

function main() {
  const args = parseArgs(process.argv.slice(2))
  const source = path.resolve(ROOT, String(args.source ?? 'database/database/candidates-master-v5.xlsx'))
  const to = Number(args.to ?? 3000)
  const dryRun = Boolean(args['dry-run'])

  const byLp = wordRowsByLp(loadMaster(source).rows).slice(0, to)
  const sentences = new Map<string, { pl: string; en: string }>()
  const withoutSentence: string[] = []
  for (const row of byLp) {
    const pl = String(row['Wybrane PL'] ?? '').trim()
    const en = String(row['Wybrane ENG'] ?? '').trim()
    if (pl && en) sentences.set(String(row['wordId']), { pl, en })
    else withoutSentence.push(`${row['wordId']} (${row['Słowo ENG']})`)
  }

  const packFiles = loadPackFiles(path.join(ROOT, 'src/data/packs'))
  let applied = 0
  let cleared = 0
  let audioSwitchedOff = 0
  let filesChanged = 0

  for (const { file, pack } of packFiles) {
    const before = JSON.stringify(pack)
    for (const word of pack.words as (typeof pack.words[number] & { sentenceAudio?: boolean })[]) {
      const s = sentences.get(word.id)
      if (s) {
        word.sentencePl = s.pl
        word.sentenceEn = s.en
        applied++
      } else {
        if (word.sentenceEn || word.sentencePl) cleared++
        word.sentencePl = null
        word.sentenceEn = null
      }
      if ('sentenceAudio' in word) {
        delete word.sentenceAudio
        audioSwitchedOff++
      }
    }
    if (JSON.stringify(pack) !== before) {
      filesChanged++
      if (!dryRun) fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n')
    }
  }

  const missingInPacks = [...sentences.keys()].filter((id) => !packFiles.some(({ pack }) => pack.words.some((w) => w.id === id)))

  console.log(`${dryRun ? '[dry run] ' : ''}Source: ${path.relative(ROOT, source)}, Lp 1-${to}`)
  console.log(`  sentences written: ${applied} (of ${sentences.size} available)`)
  console.log(`  words in range without a final sentence: ${withoutSentence.length}`)
  console.log(`  old sentences cleared outside the range: ${cleared}`)
  console.log(`  sentenceAudio flags removed: ${audioSwitchedOff}`)
  console.log(`  pack files ${dryRun ? 'that would change' : 'changed'}: ${filesChanged}`)
  if (missingInPacks.length > 0) console.warn(`  ⚠ ${missingInPacks.length} sheet word ids not found in packs: ${missingInPacks.slice(0, 5).join(', ')}`)
  if (!dryRun) console.log('Next: npm run upload-pack-blobs (needs NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN) to publish.')
}

main()
