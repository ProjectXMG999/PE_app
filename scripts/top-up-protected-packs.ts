// Rounds out the last 6 non-round packs (the ones holding a sentenced word,
// left untouched by consolidate-irregular-packs.ts) to size 10/15 — not by
// touching their existing words (which would renumber ids and misalign a
// picked sentence), but by APPENDING same-category words pulled from
// src/data/packs-incomplete/ (content already excluded from the app, so it
// has no current position to disturb). Existing word ids 1..N are never
// touched; new words are appended at N+1.. only.
//
// This closes the reason Level 1 (1087) and Level 2 (2097) totals don't end
// in 0/5 — it was exactly these 6 packs (9+9+9 in level 1, 14+14+14 in
// level 2); levels 3/4 already end in 0/5 with zero irregular packs.
//
// Usage: npx tsx scripts/top-up-protected-packs.ts [--write]

import fs from 'fs'
import path from 'path'
import { ROOT } from './sentences/lib/config.js'

const PACK_DIR = path.join(ROOT, 'src/data/packs')
const INCOMPLETE_DIR = path.join(ROOT, 'src/data/packs-incomplete')
const INDEX_PATH = path.join(ROOT, 'src/data/packages-index.json')
const WRITE = process.argv.includes('--write')

interface Word { id: string; sentenceEn: string | null; [k: string]: unknown }
interface Pack { id: string; name: string; volume: string; level: number; category: string; chapter: string; words: Word[] }
interface IndexEntry { id: string; name: string; volume: string; level: number; category: string; wordCount: number; chapter: string }

// target: each pack needs exactly +1 word (9->10, 14->15), sourced from the
// named incomplete file (same category, verified by hand against the data).
const PLAN: { packId: string; sourceFile: string }[] = [
  { packId: 't1-p062', sourceFile: 't1-p872-incomplete-18.json' }, // Rzeczowniki
  { packId: 't1-p091', sourceFile: 't1-p872-incomplete-18.json' }, // Rzeczowniki
  { packId: 't1-p167', sourceFile: 't1-p872-incomplete-18.json' }, // Rzeczowniki
  { packId: 't1-p183', sourceFile: 't1-p872-incomplete-18.json' }, // Rzeczowniki
  { packId: 't1-p076', sourceFile: 't1-p873-incomplete-6.json' },  // Czasowniki
  { packId: 't1-p198', sourceFile: 't1-p897-incomplete-0.json' },  // Przysłówki
]

function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')) as IndexEntry[]
  const packs = new Map<string, Pack>()
  for (const e of index) packs.set(e.id, JSON.parse(fs.readFileSync(path.join(PACK_DIR, `${e.id}.json`), 'utf-8')))

  const protectedBefore = new Map<string, unknown>()
  for (const p of packs.values()) for (const w of p.words) if (w.sentenceEn) protectedBefore.set(w.id, JSON.stringify(w))

  const incompleteFiles = new Map<string, Pack>()
  for (const f of fs.readdirSync(INCOMPLETE_DIR)) incompleteFiles.set(f, JSON.parse(fs.readFileSync(path.join(INCOMPLETE_DIR, f), 'utf-8')))

  for (const { packId, sourceFile } of PLAN) {
    const pack = packs.get(packId)!
    const source = incompleteFiles.get(sourceFile)!
    if (pack.category !== source.category) throw new Error(`category mismatch: ${packId} is ${pack.category}, ${sourceFile} is ${source.category}`)
    const donorWord = source.words.shift()
    if (!donorWord) throw new Error(`${sourceFile} ran out of words`)
    const newIndex = pack.words.length + 1
    const suffix = String(newIndex).padStart(3, '0')
    const wid = `${packId}-${suffix}`
    pack.words.push({
      ...donorWord,
      id: wid,
      sentenceEn: null,
      sentencePl: null,
      audioWord: `${wid}-word.mp3`,
      audioWordPl: `${wid}-word-pl.mp3`,
      audioSentence: `${wid}-sentence.mp3`,
    })
    console.log(`${packId} [${pack.category}] ${pack.words.length - 1} -> ${pack.words.length} words (+"${donorWord.english}" from ${sourceFile})`)
  }

  // Drop now-empty incomplete files, update the rest, update index wordCounts.
  const emptiedFiles: string[] = []
  for (const [f, p] of incompleteFiles) {
    if (p.words.length === 0) emptiedFiles.push(f)
  }
  console.log(`\nIncomplete files fully consumed (removed): ${emptiedFiles.join(', ') || '(none)'}`)

  const finalIndex = index.map((e) => {
    const p = packs.get(e.id)
    return p ? { ...e, wordCount: p.words.length } : e
  })

  // --- verify: protected words 100% unchanged ---
  let mismatches = 0
  for (const [wid, before] of protectedBefore) {
    let found: Word | undefined
    for (const p of packs.values()) { found = p.words.find((w) => w.id === wid); if (found) break }
    if (!found || JSON.stringify(found) !== before) mismatches++
  }
  console.log(`\nVerification: ${protectedBefore.size - mismatches}/${protectedBefore.size} protected words unchanged.`)
  if (mismatches > 0) { console.error(`ABORT: ${mismatches} protected words would change.`); process.exit(1) }

  const byLevel = new Map<number, number>()
  for (const e of finalIndex) byLevel.set(e.level, (byLevel.get(e.level) ?? 0) + e.wordCount)
  console.log('\nNew level totals:')
  for (const [lvl, words] of [...byLevel].sort((a, b) => a[0] - b[0])) console.log(`  Level ${lvl}: ${words} (${words % 5 === 0 ? 'OK, ends in 0/5' : 'still not 0/5!'})`)

  if (!WRITE) { console.log('\nDry run only — pass --write to apply.'); return }

  for (const { packId } of PLAN) fs.writeFileSync(path.join(PACK_DIR, `${packId}.json`), JSON.stringify(packs.get(packId), null, 2) + '\n')
  for (const [f, p] of incompleteFiles) {
    const full = path.join(INCOMPLETE_DIR, f)
    if (p.words.length === 0) fs.unlinkSync(full)
    else fs.writeFileSync(full, JSON.stringify(p, null, 2) + '\n')
  }
  fs.writeFileSync(INDEX_PATH, JSON.stringify(finalIndex, null, 2) + '\n')
  console.log('\nWrote updated packs, incomplete files, and packages-index.json.')
}

main()
