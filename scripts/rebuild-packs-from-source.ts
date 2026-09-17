// One-off, carefully-verified rebuild of src/data/packs + packages-index.json
// from the master CSV, fixing two bugs found in September 2026:
//
//   1. The master CSV has 400 exact-duplicate rows (same English + same
//      Polish) scattered through the file (whole blocks like "Fantasy"
//      repeated many times) — pure bloat, safe to drop.
//   2. packages-index.json (which drives the app's browsing order) is stale
//      relative to the CSV: some packs (e.g. "Kraje", "Biznes" — level 1,
//      early Lp) sit deep among level-4 content because past incremental
//      imports preserved historical array positions instead of true CSV
//      order.
//
// The risk: word ids like "t1-p159-005" encode POSITION within a pack, and
// candidates-master-v5.xlsx's picked sentences are keyed by that exact id
// string with no content check. Naively re-running parse-wizard-csv.ts after
// deduping shifts positions inside any pack a removed row belonged to,
// silently reattaching a sentence to the WRONG word (verified with a real
// broken run: t1-p159's sentence for "Adult" ended up under "Retired").
//
// Safety strategy:
//   - A "protected" pack is any current pack holding >=1 word with
//     sentenceEn set (2953 words, ~251 packs as of writing).
//   - Protected blocks are matched to their true CSV block by their exact
//     ordered ENGLISH sequence (english is CSV-derived only, unaffected by
//     the separate Polish-translation cleanup already applied from the
//     master sheet) and are then NEVER touched: no row removed, and their
//     existing pack JSON `words` array is copied verbatim (so sentenceEn/
//     sentencePl/audio fields/polish/polishAudio all survive exactly).
//   - Duplicate-row removal only ever removes rows outside protected
//     blocks. A duplicate of protected content elsewhere is removed even if
//     it happens to sit earlier in Lp order than the protected occurrence.
//   - Ordering fix (packages-index.json array order = true CSV order)
//     applies globally, to every pack — this is what actually fixes the
//     Kraje/Biznes-style navigation bug, not just for those two.
//   - Before anything is written to disk, every one of the pre-run's 2953
//     sentenced word ids must map, in the freshly-computed result, to the
//     exact same english/polish/sentenceEn/sentencePl. If even one doesn't,
//     the script aborts and writes nothing.
//
// Usage:
//   npx tsx scripts/rebuild-packs-from-source.ts            # dry run, report only
//   npx tsx scripts/rebuild-packs-from-source.ts --write     # apply for real

import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { normalizeEnglishForAudio, fixRodzialTypo } from './parse-wizard-csv.js'
import { cleanPolishTranslation, normalizePolishForAudio } from './sentences/lib/polishText.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CSV_PATH = path.join(ROOT, 'database/database/Baza Wizard (prawdopodobnie najnowsza baza, bez zdań) KOPIA  - Cała baza.csv')
const OUT_DIR = path.join(ROOT, 'src/data/packs')
const INDEX_PATH = path.join(ROOT, 'src/data/packages-index.json')

const WRITE = process.argv.includes('--write')

interface Row {
  lp: number
  level: number
  volume: string
  chapter: string
  category: string
  packName: string
  english: string
  polish: string
}

interface WordOut {
  id: string
  english: string
  polish: string
  polishAudio?: string
  sentenceEn: string | null
  sentencePl: string | null
  audioWord: string
  audioWordPl?: string
  audioSentence: string
  audioSentencePl?: string
  sentenceAudio?: boolean
  [k: string]: unknown
}

function loadCsvRows(): Row[] {
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true, dynamicTyping: false })
  const rows = parsed.data as Record<string, unknown>[]
  const mapped: Row[] = rows.map(r => ({
    lp: Number(r['Lp'] ?? 0) || 0,
    level: Number(String(r['Poziom'] ?? '').trim()) || 1,
    volume: String(r['Tom'] ?? '').trim(),
    chapter: fixRodzialTypo(String(r['Rozdział'] ?? '').trim()),
    category: String(r['Jednostka'] ?? '').trim(),
    packName: String(r['Nazwa paczki'] ?? '').trim(),
    english: String(r['Słowo ENG'] ?? '').trim(),
    polish: String(r['Tłumaczenie PL'] ?? '').trim(),
  }))
  const valid = mapped.filter(r => r.english && r.polish && r.packName && r.category !== 'Klony')
  for (const r of valid) {
    if (r.category === 'Zabronione') r.category = 'Wulgaryzmy'
    if (!r.category) r.category = 'Inne'
  }
  return valid
}

function groupBlocks(rows: Row[]): Row[][] {
  const blocks: Row[][] = []
  let current: Row[] = []
  let prevKey = ''
  for (const row of rows) {
    const key = `${row.packName}|||${row.category}`
    if (key !== prevKey) {
      if (current.length > 0) blocks.push(current)
      current = []
      prevKey = key
    }
    current.push(row)
  }
  if (current.length > 0) blocks.push(current)
  return blocks
}

function main() {
  console.log(`Mode: ${WRITE ? 'WRITE (applying to disk)' : 'DRY RUN (report only, nothing written)'}`)

  // --- load current state ---
  const packFiles = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json'))
  const currentPacks = packFiles.map(f => ({
    file: f,
    pack: JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf-8')) as { id: string; name: string; volume: string; level: number; category: string; chapter: string; words: WordOut[] },
  }))

  const protectedBefore = new Map<string, { english: string; polish: string; sentenceEn: string | null; sentencePl: string | null }>()
  for (const { pack } of currentPacks) {
    for (const w of pack.words) {
      if (w.sentenceEn) protectedBefore.set(w.id, { english: w.english, polish: w.polish, sentenceEn: w.sentenceEn, sentencePl: w.sentencePl })
    }
  }
  console.log(`Protected (sentenced) words in current data: ${protectedBefore.size}`)

  const protectedPackIds = new Set([...currentPacks].filter(({ pack }) => pack.words.some(w => w.sentenceEn)).map(({ pack }) => pack.id))
  console.log(`Protected packs: ${protectedPackIds.size}`)

  // --- parse fresh CSV, group into true blocks (Lp order) ---
  const rows = loadCsvRows()
  console.log(`Valid CSV rows: ${rows.length}`)
  const trueBlocks = groupBlocks(rows)
  console.log(`True contiguous blocks (pre-dedup): ${trueBlocks.length}`)

  // --- normalized english fingerprint per row, used for both matching and duplicate keys ---
  const normEng = (r: Row) => normalizeEnglishForAudio(r.english, r.category)
  const blockEngSeq = (b: Row[]) => b.map(normEng).join('')

  // --- match each protected current pack to its true block by exact english sequence ---
  const currentPackEngSeq = new Map<string, string>() // packId -> english sequence
  for (const { pack } of currentPacks) currentPackEngSeq.set(pack.id, pack.words.map(w => w.english).join(''))

  const blockToProtectedId = new Map<number, string>() // trueBlocks index -> pack id
  const matchedPackIds = new Set<string>()
  for (let i = 0; i < trueBlocks.length; i++) {
    const seq = blockEngSeq(trueBlocks[i])
    for (const packId of protectedPackIds) {
      if (matchedPackIds.has(packId)) continue
      if (currentPackEngSeq.get(packId) === seq) {
        blockToProtectedId.set(i, packId)
        matchedPackIds.add(packId)
        break
      }
    }
  }
  console.log(`Protected packs matched to a true block by exact content: ${matchedPackIds.size} / ${protectedPackIds.size}`)
  if (matchedPackIds.size !== protectedPackIds.size) {
    const unmatched = [...protectedPackIds].filter(id => !matchedPackIds.has(id))
    console.error(`ABORT: ${unmatched.length} protected pack(s) could not be matched to a CSV block by content — refusing to proceed.`)
    console.error(unmatched.slice(0, 20).join(', '))
    process.exit(1)
  }

  const protectedRowIdx = new Set<number>() // global row index (within `rows`) that belongs to a protected block
  {
    let offset = 0
    for (let i = 0; i < trueBlocks.length; i++) {
      if (blockToProtectedId.has(i)) {
        for (let j = 0; j < trueBlocks[i].length; j++) protectedRowIdx.add(offset + j)
      }
      offset += trueBlocks[i].length
    }
  }

  // --- duplicate marking: protected rows claim their key first, regardless of Lp order ---
  const seenKeys = new Set<string>()
  const dupKey = (r: Row) => `${r.english.trim().toLowerCase()}|||${r.polish.trim().toLowerCase()}`
  let gi = 0
  for (const b of trueBlocks) for (const r of b) { if (protectedRowIdx.has(gi)) seenKeys.add(dupKey(r)); gi++ }

  const keep: boolean[] = new Array(rows.length).fill(true)
  gi = 0
  let removedCount = 0
  for (const b of trueBlocks) {
    for (const r of b) {
      if (!protectedRowIdx.has(gi)) {
        const k = dupKey(r)
        if (seenKeys.has(k)) { keep[gi] = false; removedCount++ }
        else seenKeys.add(k)
      }
      gi++
    }
  }
  console.log(`Duplicate rows removed (outside protected packs): ${removedCount}`)

  // --- rebuild blocks post-dedup, drop empty ones ---
  const finalBlocks: { rows: Row[]; protectedId?: string }[] = []
  {
    let offset = 0
    for (let i = 0; i < trueBlocks.length; i++) {
      const b = trueBlocks[i]
      const survivors = b.filter((_, j) => keep[offset + j])
      offset += b.length
      if (survivors.length === 0) continue
      finalBlocks.push({ rows: survivors, protectedId: blockToProtectedId.get(i) })
    }
  }
  console.log(`Final blocks after dropping fully-duplicate ones: ${finalBlocks.length} (was ${trueBlocks.length})`)

  // --- id assignment: protected blocks keep their matched id; others try content reuse, else new id ---
  const existingIds = new Set(currentPacks.map(({ pack }) => pack.id))
  let maxNum = 0
  for (const id of existingIds) { const n = Number(id.replace(/^t1-p/, '')); if (n > maxNum) maxNum = n }

  const claimedIds = new Set<string>(matchedPackIds)
  const nonProtectedCurrent = currentPacks.filter(({ pack }) => !protectedPackIds.has(pack.id))

  const finalWithIds: { rows: Row[]; id: string; reused: boolean; protectedId?: string }[] = []
  for (const fb of finalBlocks) {
    if (fb.protectedId) { finalWithIds.push({ rows: fb.rows, id: fb.protectedId, reused: true, protectedId: fb.protectedId }); continue }
    const seq = blockEngSeq(fb.rows)
    let matchedId: string | undefined
    for (const { pack } of nonProtectedCurrent) {
      if (claimedIds.has(pack.id)) continue
      if (currentPackEngSeq.get(pack.id) === seq) { matchedId = pack.id; break }
    }
    if (matchedId) { claimedIds.add(matchedId); finalWithIds.push({ rows: fb.rows, id: matchedId, reused: true }) }
    else { maxNum++; const id = `t1-p${String(maxNum).padStart(3, '0')}`; finalWithIds.push({ rows: fb.rows, id, reused: false }) }
  }
  const droppedOldIds = [...existingIds].filter(id => !claimedIds.has(id) && !finalWithIds.some(f => f.id === id))
  console.log(`New ids assigned (no content match found): ${finalWithIds.filter(f => !f.reused).length}`)
  console.log(`Old pack ids no longer used (their files will be removed): ${droppedOldIds.length}`)

  // --- build final pack objects ---
  const currentPackById = new Map(currentPacks.map(({ pack }) => [pack.id, pack] as const))
  const newPacks: { id: string; name: string; volume: string; level: number; category: string; chapter: string; words: WordOut[] }[] = []

  for (const f of finalWithIds) {
    const first = f.rows[0]
    if (f.protectedId) {
      // Never touched — copy the existing pack's words verbatim (preserves sentence + audio fields exactly).
      const existing = currentPackById.get(f.protectedId)!
      newPacks.push({ id: f.protectedId, name: first.packName, volume: existing.volume, level: existing.level, category: existing.category, chapter: existing.chapter, words: existing.words })
      continue
    }
    const words: WordOut[] = f.rows.map((r, i) => {
      const en = normalizeEnglishForAudio(r.english, r.category)
      const fullPl = cleanPolishTranslation(r.polish)
      const plAudio = normalizePolishForAudio(fullPl)
      const wid = `${f.id}-${String(i + 1).padStart(3, '0')}`
      return {
        id: wid,
        english: en,
        polish: fullPl,
        polishAudio: plAudio,
        sentenceEn: null,
        sentencePl: null,
        audioWord: `${wid}-word.mp3`,
        audioWordPl: `${wid}-word-pl.mp3`,
        audioSentence: `${wid}-sentence.mp3`,
      }
    })
    newPacks.push({ id: f.id, name: first.packName, volume: first.volume, level: first.level, category: first.category, chapter: first.chapter, words })
  }

  // --- VERIFY before writing anything ---
  const afterMap = new Map<string, { english: string; polish: string; sentenceEn: string | null; sentencePl: string | null }>()
  for (const p of newPacks) for (const w of p.words) if (w.sentenceEn) afterMap.set(w.id, { english: w.english, polish: w.polish, sentenceEn: w.sentenceEn, sentencePl: w.sentencePl })

  let mismatches = 0
  const mismatchExamples: string[] = []
  for (const [id, before] of protectedBefore) {
    const after = afterMap.get(id)
    if (!after || after.english !== before.english || after.polish !== before.polish || after.sentenceEn !== before.sentenceEn || after.sentencePl !== before.sentencePl) {
      mismatches++
      if (mismatchExamples.length < 15) mismatchExamples.push(`${id}: before="${before.english}" after="${after?.english ?? 'MISSING'}"`)
    }
  }
  console.log(`\nVerification: ${protectedBefore.size - mismatches}/${protectedBefore.size} protected words match exactly.`)
  if (mismatches > 0) {
    console.error(`ABORT: ${mismatches} protected word(s) would change. Nothing written.`)
    mismatchExamples.forEach(e => console.error('  ' + e))
    process.exit(1)
  }

  // --- order check: packIndex order is just finalWithIds order (already true Lp order) ---
  const krajeIdx = newPacks.findIndex(p => p.name === 'Kraje')
  const biznesIdx = newPacks.findIndex(p => p.name === 'Biznes')
  console.log(`Sanity: "Kraje" now at index ${krajeIdx}, "Biznes" now at index ${biznesIdx} (previously 672/688 — should now be small).`)

  const totalWords = newPacks.reduce((s, p) => s + p.words.length, 0)
  console.log(`\nTotal packs: ${newPacks.length} (was ${currentPacks.length}) | total words: ${totalWords} (was ${currentPacks.reduce((s, { pack }) => s + pack.words.length, 0)})`)

  if (!WRITE) {
    console.log('\nDry run only — pass --write to apply.')
    return
  }

  // --- write CSV (deduped) ---
  const keptRowSet = new Set<number>()
  { let idx = 0; for (const b of trueBlocks) for (const r of b) { if (keep[idx]) keptRowSet.add(idx); idx++ } }
  const keptRows = rows.filter((_, i) => keptRowSet.has(i))
  const origParsed = Papa.parse(fs.readFileSync(CSV_PATH, 'utf-8'), { header: true, skipEmptyLines: true })
  const fields = origParsed.meta.fields!
  const keptRowsByLp = new Map(keptRows.map(r => [r.lp, r] as const))
  const csvOut = (origParsed.data as Record<string, unknown>[]).filter(r => keptRowsByLp.has(Number(r['Lp'])))
  fs.writeFileSync(CSV_PATH, Papa.unparse({ fields, data: csvOut }, { newline: '\n' }) + '\n')
  console.log(`CSV rewritten: ${csvOut.length} rows (removed ${rows.length - csvOut.length} non-protected duplicates).`)

  // --- write pack files, remove dropped ones ---
  for (const id of droppedOldIds) {
    const file = path.join(OUT_DIR, `${id}.json`)
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
  for (const p of newPacks) fs.writeFileSync(path.join(OUT_DIR, `${p.id}.json`), JSON.stringify(p, null, 2) + '\n')

  const index = newPacks.map(p => ({ id: p.id, name: p.name, volume: p.volume, level: p.level, category: p.category, wordCount: p.words.length, chapter: p.chapter }))
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n')

  console.log(`\nWrote ${newPacks.length} pack files and packages-index.json. Removed ${droppedOldIds.length} obsolete pack file(s).`)
}

main()
