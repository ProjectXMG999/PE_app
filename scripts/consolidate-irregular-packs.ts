// Consolidates the 59 non-round-sized packs (leftovers from the duplicate-
// row removal fix — sizes like 8, 9, 11-14, 23 instead of the catalog's two
// normal sizes, 10 and 15) by merging same-CATEGORY packs, in true Lp
// order, into clean 15- and 10-word packs. Whatever doesn't fit a round
// chunk is marked incomplete and pulled out of packages-index.json (so the
// app never counts, navigates to, or processes it) — its file is moved to
// src/data/packs-incomplete/, not deleted.
//
// Packs already holding a sentenced word (6 of the 59) are left completely
// untouched — merging would renumber their words and silently misalign an
// already-picked sentence, exactly the bug the September rebuild fixed.
//
// Safety: refuses to write anything unless every one of the 2953 sentenced
// word ids still resolves to the exact same english/polish/sentenceEn/
// sentencePl afterward (trivially true here since protected packs are
// never touched, but checked anyway as a hard guarantee).
//
// Usage:
//   npx tsx scripts/consolidate-irregular-packs.ts            # dry run
//   npx tsx scripts/consolidate-irregular-packs.ts --write

import fs from 'fs'
import path from 'path'
import { ROOT } from './sentences/lib/config.js'

const PACK_DIR = path.join(ROOT, 'src/data/packs')
const INCOMPLETE_DIR = path.join(ROOT, 'src/data/packs-incomplete')
const INDEX_PATH = path.join(ROOT, 'src/data/packages-index.json')
const WRITE = process.argv.includes('--write')

interface IndexEntry { id: string; name: string; volume: string; level: number; category: string; wordCount: number; chapter: string }
interface Word { id: string; sentenceEn: string | null; [k: string]: unknown }
interface Pack { id: string; name: string; volume: string; level: number; category: string; chapter: string; words: Word[] }

function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')) as IndexEntry[]
  const packs = new Map<string, Pack>()
  for (const e of index) packs.set(e.id, JSON.parse(fs.readFileSync(path.join(PACK_DIR, `${e.id}.json`), 'utf-8')))

  const protectedBefore = new Map<string, unknown>()
  for (const p of packs.values()) for (const w of p.words) if (w.sentenceEn) protectedBefore.set(w.id, JSON.stringify(w))

  const irregular = index.filter((e) => e.wordCount % 5 !== 0)
  const protectedIds = new Set(irregular.filter((e) => packs.get(e.id)!.words.some((w) => w.sentenceEn)).map((e) => e.id))
  const candidates = irregular.filter((e) => !protectedIds.has(e.id))
  console.log(`Irregular packs: ${irregular.length} (${protectedIds.size} protected — left untouched, ${candidates.length} candidates for consolidation)`)

  const byCategory = new Map<string, IndexEntry[]>()
  for (const e of candidates) {
    const arr = byCategory.get(e.category) ?? []
    arr.push(e)
    byCategory.set(e.category, arr)
  }

  const consumedIds = new Set<string>() // old pack ids merged away or marked incomplete
  const newPacksToWrite: Pack[] = []
  const incompletePacksToMove: Pack[] = []
  const newIndexEntries: { entry: IndexEntry; anchorPos: number }[] = []

  for (const [category, list] of byCategory) {
    list.sort((a, b) => index.indexOf(a) - index.indexOf(b))
    // Flatten all words of this category's irregular packs, in true order,
    // remembering which source pack (for the name) and anchor position
    // (for where the merged pack sits in the app's browse order) each
    // word's run belongs to.
    const flat: { word: Word; sourceName: string; sourcePos: number }[] = []
    for (const e of list) {
      const p = packs.get(e.id)!
      const pos = index.indexOf(e)
      for (const w of p.words) flat.push({ word: w, sourceName: e.name, sourcePos: pos })
    }

    let i = 0
    let chunkNum = 0
    while (i < flat.length) {
      const remaining = flat.length - i
      const size = remaining >= 15 ? 15 : remaining === 10 ? 10 : -1
      if (size === -1) {
        // Leftover: doesn't fill a round chunk. Mark incomplete.
        const rest = flat.slice(i)
        const names = [...new Set(rest.map((r) => r.sourceName))]
        const anchor = list[0]
        const incompletePack: Pack = {
          id: `${anchor.id}-incomplete-${chunkNum}`,
          name: names.join(' / '),
          volume: packs.get(anchor.id)!.volume,
          level: packs.get(anchor.id)!.level,
          category,
          chapter: packs.get(anchor.id)!.chapter,
          words: rest.map((r) => r.word),
        }
        incompletePacksToMove.push(incompletePack)
        i = flat.length
        continue
      }
      const chunk = flat.slice(i, i + size)
      const names = [...new Set(chunk.map((c) => c.sourceName))]
      const anchorEntry = list.find((e) => index.indexOf(e) === chunk[0].sourcePos)!
      const anchorPack = packs.get(anchorEntry.id)!
      const newId = anchorEntry.id
      const words: Word[] = chunk.map((c, j) => {
        const suffix = String(j + 1).padStart(3, '0')
        const wid = `${newId}-${suffix}`
        return {
          ...c.word,
          id: wid,
          audioWord: `${wid}-word.mp3`,
          audioWordPl: `${wid}-word-pl.mp3`,
          audioSentence: `${wid}-sentence.mp3`,
          audioSentencePl: (c.word as Word & { audioSentencePl?: string }).audioSentencePl ? `${wid}-sentence-pl.mp3` : undefined,
        }
      })
      const newPack: Pack = { id: newId, name: names.join(' / '), volume: anchorPack.volume, level: anchorPack.level, category, chapter: anchorPack.chapter, words }
      newPacksToWrite.push(newPack)
      newIndexEntries.push({ entry: { id: newId, name: newPack.name, volume: newPack.volume, level: newPack.level, category, wordCount: words.length, chapter: newPack.chapter }, anchorPos: chunk[0].sourcePos })
      chunkNum++
      i += size
    }
    for (const e of list) consumedIds.add(e.id)
  }

  // Every consumed id disappears from the index; anchor ids reappear as the
  // new merged pack (possibly with a different word count/name).
  const anchorIds = new Set(newIndexEntries.map((n) => n.entry.id))
  const finalIndex: IndexEntry[] = []
  for (let pos = 0; pos < index.length; pos++) {
    const e = index[pos]
    if (!consumedIds.has(e.id)) { finalIndex.push(e); continue }
    const asNew = newIndexEntries.find((n) => n.anchorPos === pos)
    if (asNew) finalIndex.push(asNew.entry)
    // else: this position's pack was consumed into an earlier anchor, or is incomplete — dropped.
  }

  console.log(`\nNew consolidated packs: ${newPacksToWrite.length} (all size 10 or 15)`)
  console.log(`Incomplete packs (moved out of the app): ${incompletePacksToMove.length}, words: ${incompletePacksToMove.reduce((s, p) => s + p.words.length, 0)}`)
  incompletePacksToMove.forEach((p) => console.log(`  ${p.id} [${p.category}] "${p.name}": ${p.words.length} words`))
  console.log(`Packs removed from src/data/packs (merged into an anchor): ${consumedIds.size - newPacksToWrite.length - incompletePacksToMove.length}`)
  console.log(`Final index size: ${finalIndex.length} (was ${index.length})`)

  // --- verification: protected words must be 100% untouched ---
  const afterPacks = new Map(packs)
  for (const p of newPacksToWrite) afterPacks.set(p.id, p)
  let mismatches = 0
  for (const [wid, before] of protectedBefore) {
    let found: Word | undefined
    for (const p of afterPacks.values()) { found = p.words.find((w) => w.id === wid); if (found) break }
    if (!found || JSON.stringify(found) !== before) mismatches++
  }
  console.log(`\nVerification: ${protectedBefore.size - mismatches}/${protectedBefore.size} protected words unchanged.`)
  if (mismatches > 0) { console.error(`ABORT: ${mismatches} protected words would change.`); process.exit(1) }

  const totalWords = finalIndex.reduce((s, e) => s + e.wordCount, 0)
  console.log(`Total words in app after consolidation: ${totalWords}`)

  if (!WRITE) { console.log('\nDry run only — pass --write to apply.'); return }

  fs.mkdirSync(INCOMPLETE_DIR, { recursive: true })
  for (const id of consumedIds) {
    if (!anchorIds.has(id)) {
      const f = path.join(PACK_DIR, `${id}.json`)
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }
  }
  for (const p of newPacksToWrite) fs.writeFileSync(path.join(PACK_DIR, `${p.id}.json`), JSON.stringify(p, null, 2) + '\n')
  for (const p of incompletePacksToMove) fs.writeFileSync(path.join(INCOMPLETE_DIR, `${p.id}.json`), JSON.stringify(p, null, 2) + '\n')
  fs.writeFileSync(INDEX_PATH, JSON.stringify(finalIndex, null, 2) + '\n')
  console.log('\nWrote consolidated packs, moved incomplete packs, updated packages-index.json.')
}

main()
