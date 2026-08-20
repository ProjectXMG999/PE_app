// Build a review copy of the master word database (all original columns)
// with 6 new columns appended: 3 candidate EN/PL sentence pairs per word,
// sourced from the generation checkpoint. This is the file to actually
// review and pick the best candidate from per word — it carries the same
// row-to-word-id mapping used by export-words-with-sentences.ts, so every
// row is traceable back to its pack word id even though the master CSV
// itself has no id column.
//
// Review workflow: in candidates-master.xlsx, fill the "Wybrane" column
// with 1, 2, or 3 for whichever candidate is best for that word (you may
// also edit the sentence text in the chosen cell directly — the apply step
// reads the live cell content, not the original generation). Leave "Wybrane"
// blank for words you haven't decided on yet. Then run gen-sentences:apply-chosen.
//
// Re-running this export (e.g. after generating more words) preserves
// whatever you already typed into "Wybrane" in the existing file — it's
// read back and merged in before the new file is written, so scaling up
// generation never wipes out review progress you've already done.
//
// Output (gitignored, working data): sentence-output/candidates-master.csv
// and .xlsx.
//
// Usage: npm run gen-sentences:master-export

import Papa from 'papaparse'
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { loadConfig, ROOT } from './sentences/lib/config.js'
import { loadAllRecords } from './sentences/lib/checkpoint.js'
import type { CheckpointRecord } from './sentences/lib/types.js'

const CSV_PATH = path.join(
  ROOT,
  'database/database/Baza Wizard (prawdopodobnie najnowsza baza, bez zdań) KOPIA  - Cała baza.csv'
)
const PACK_DIR = path.join(ROOT, 'src/data/packs')
const INDEX_PATH = path.join(ROOT, 'src/data/packages-index.json')
const OUT_DIR = path.join(ROOT, 'sentence-output')
const OUT_CSV_PATH = path.join(OUT_DIR, 'candidates-master.csv')
const OUT_XLSX_PATH = path.join(OUT_DIR, 'candidates-master.xlsx')
const SHEET_NAME = 'Kandydaci zdań'

function loadExistingChoices(xlsxPath: string): Map<string, string> {
  const choices = new Map<string, string>()
  if (!fs.existsSync(xlsxPath)) return choices
  const workbook = XLSX.readFile(xlsxPath)
  const sheet = workbook.Sheets[SHEET_NAME]
  if (!sheet) return choices
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  for (const row of rows) {
    const wordId = String(row['wordId'] ?? '').trim()
    const chosen = String(row['Wybrane'] ?? '').trim()
    if (wordId && chosen) choices.set(wordId, chosen)
  }
  return choices
}

interface DerivedRow {
  packName: string
  category: string
  english: string
  polish: string
  valid: boolean
}

function csvEscape(s: unknown): string {
  if (s === null || s === undefined) return ''
  const str = String(s)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function main() {
  const config = loadConfig(process.argv.slice(2))
  const records = loadAllRecords(config.checkpointPath)
  if (records.length === 0) {
    console.log(`No generated sentences found at ${config.checkpointPath}. Run gen-sentences first.`)
    return
  }
  const recordsById = new Map<string, CheckpointRecord>()
  for (const r of records) recordsById.set(r.id, r)

  console.log('Reading master Wizard CSV...')
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  if (parsed.errors.length > 0) console.warn('CSV parse warnings:', parsed.errors)

  const rawRows = parsed.data
  const fields = parsed.meta.fields ?? []
  console.log(`Total rows: ${rawRows.length}`)

  // Same derivation/blocking as export-words-with-sentences.ts, so a CSV
  // row maps 1:1 to a pack word id via the same contiguous-block matching.
  const derived: DerivedRow[] = rawRows.map((r) => {
    const packName = String(r['Nazwa paczki'] ?? '').trim()
    let category = String(r['Jednostka'] ?? '').trim()
    const english = String(r['Słowo ENG'] ?? '').trim()
    const polish = String(r['Tłumaczenie PL'] ?? '').trim()
    if (category === 'Zabronione') category = 'Wulgaryzmy'
    if (!category) category = 'Inne'
    const valid = !!(english && polish && packName && category !== 'Klony')
    return { packName, category, english, polish, valid }
  })

  const blocks: { key: string; rowIndices: number[] }[] = []
  let prevKey = ''
  for (let i = 0; i < derived.length; i++) {
    const row = derived[i]
    if (!row.valid) continue
    const key = `${row.packName}|||${row.category}`
    if (key !== prevKey) {
      blocks.push({ key, rowIndices: [] })
      prevKey = key
    }
    blocks[blocks.length - 1].rowIndices.push(i)
  }
  console.log(`Contiguous blocks: ${blocks.length}`)

  const existingIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')) as {
    id: string
    name: string
    category: string
  }[]
  const idQueues = new Map<string, string[]>()
  for (const entry of existingIndex) {
    const key = `${entry.name}|||${entry.category}`
    if (!idQueues.has(key)) idQueues.set(key, [])
    idQueues.get(key)!.push(entry.id)
  }

  // rowIndex -> word id, read from the actual pack JSON word at the same
  // position (not reconstructed from a naming pattern) — same approach as
  // export-words-with-sentences.ts, so this stays correct even if id
  // formatting ever has exceptions.
  const packCache = new Map<string, { words: { id: string }[] }>()
  const wordIdByRow = new Map<number, string>()
  let matchedBlocks = 0
  let unmatchedBlocks = 0

  for (const block of blocks) {
    const packId = idQueues.get(block.key)?.shift()
    if (!packId) {
      unmatchedBlocks++
      console.warn(`  ⚠ No pack id found for block "${block.key}" — skipping`)
      continue
    }
    matchedBlocks++

    let pack = packCache.get(packId)
    if (!pack) {
      const packPath = path.join(PACK_DIR, `${packId}.json`)
      if (!fs.existsSync(packPath)) {
        console.warn(`  ⚠ Pack file not found: ${packPath}`)
        continue
      }
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'))
      packCache.set(packId, pack!)
    }

    block.rowIndices.forEach((rowIndex, i) => {
      const word = pack!.words[i]
      if (word) wordIdByRow.set(rowIndex, word.id)
    })
  }
  console.log(`Matched blocks: ${matchedBlocks}, unmatched blocks: ${unmatchedBlocks}`)

  const existingChoices = loadExistingChoices(OUT_XLSX_PATH)
  if (existingChoices.size > 0) {
    console.log(`Carrying forward ${existingChoices.size} existing "Wybrane" picks from a previous export`)
  }

  let rowsWithCandidates = 0
  const header = [
    ...fields,
    'wordId',
    'Wybrane',
    'Zdanie ENG 1',
    'Zdanie PL 1',
    'Zdanie ENG 2',
    'Zdanie PL 2',
    'Zdanie ENG 3',
    'Zdanie PL 3',
  ]
  const sheetRows: string[][] = [header]

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const wordId = wordIdByRow.get(i)
    const record = wordId ? recordsById.get(wordId) : undefined
    if (record) rowsWithCandidates++

    const row = fields.map((f) => raw[f] ?? '')
    row.push(wordId ?? '')
    row.push((wordId && existingChoices.get(wordId)) ?? '')
    row.push(record?.candidate1En ?? '')
    row.push(record?.candidate1Pl ?? '')
    row.push(record?.candidate2En ?? '')
    row.push(record?.candidate2Pl ?? '')
    row.push(record?.candidate3En ?? '')
    row.push(record?.candidate3Pl ?? '')
    sheetRows.push(row)
  }
  console.log(`Rows with generated candidates: ${rowsWithCandidates} / ${rawRows.length}`)

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const csv = sheetRows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
  // BOM for correct Polish diacritics display in Excel
  fs.writeFileSync(OUT_CSV_PATH, '﻿' + csv, 'utf-8')
  console.log(`✓ Wrote ${rawRows.length} data rows to ${OUT_CSV_PATH}`)

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
  worksheet['!cols'] = header.map((h) => {
    const maxLen = sheetRows.reduce((max, row) => Math.max(max, String(row[header.indexOf(h)] ?? '').length), h.length)
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) }
  })
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }) }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME)
  XLSX.writeFile(workbook, OUT_XLSX_PATH)
  console.log(`✓ Wrote ${rawRows.length} data rows to ${OUT_XLSX_PATH}`)
}

main()
