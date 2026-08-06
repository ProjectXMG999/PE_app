import Papa from 'papaparse'
import XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const CSV_PATH = path.join(ROOT, 'database/database/Baza Wizard (prawdopodobnie najnowsza baza, bez zdań) KOPIA  - Cała baza.csv')
const PACK_DIR = path.join(ROOT, 'src/data/packs')
const INDEX_PATH = path.join(ROOT, 'src/data/packages-index.json')
const OUT_CSV_PATH = path.join(ROOT, 'database/database/Baza Wizard + Zdania - Cała baza.csv')
const OUT_XLSX_PATH = path.join(ROOT, 'database/database/Baza Wizard + Zdania - Cała baza.xlsx')

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
  console.log('Reading Wizard CSV...')
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')

  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  if (parsed.errors.length > 0) {
    console.warn('CSV Parse warnings:', parsed.errors)
  }

  const rawRows = parsed.data
  const fields = parsed.meta.fields ?? []
  console.log(`Total rows: ${rawRows.length}`)

  // Ten sam filtr/derywacja co w parse-wizard-csv.ts, ale bez zapisu paczek —
  // tylko po to, żeby odtworzyć te same ciągłe bloki i sparować wiersze CSV
  // 1:1 ze słowami w istniejących pack JSON-ach.
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

  const validCount = derived.filter((r) => r.valid).length
  console.log(`Valid rows (with ENG + PL + pack name, not Klony): ${validCount}`)

  // Ciągłe bloki: nowy blok gdy zmienia się Nazwa paczki LUB Jednostka (tylko ważne wiersze)
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

  // Odtwórz tę samą kolejkę ID co parse-wizard-csv.ts, z packages-index.json
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

  const packCache = new Map<string, { words: { sentenceEn: string | null; sentencePl: string | null }[] }>()
  const sentenceByRow = new Map<number, { sentenceEn: string | null; sentencePl: string | null }>()

  let matchedBlocks = 0
  let unmatchedBlocks = 0
  let sentencesAttached = 0

  for (const block of blocks) {
    const queue = idQueues.get(block.key)
    const id = queue?.shift()
    if (!id) {
      unmatchedBlocks++
      console.warn(`  ⚠ No pack id found for block "${block.key}" (${block.rowIndices.length} rows) — skipping`)
      continue
    }
    matchedBlocks++

    let pack = packCache.get(id)
    if (!pack) {
      const packPath = path.join(PACK_DIR, `${id}.json`)
      if (!fs.existsSync(packPath)) {
        console.warn(`  ⚠ Pack file not found: ${packPath}`)
        continue
      }
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'))
      packCache.set(id, pack!)
    }

    block.rowIndices.forEach((rowIndex, i) => {
      const word = pack!.words[i]
      if (!word) return
      sentenceByRow.set(rowIndex, { sentenceEn: word.sentenceEn, sentencePl: word.sentencePl })
      if (word.sentenceEn) sentencesAttached++
    })
  }

  console.log(`Matched blocks: ${matchedBlocks}, unmatched blocks: ${unmatchedBlocks}`)
  console.log(`Sentences attached: ${sentencesAttached}`)

  // Zbuduj surowe wiersze (bez CSV-escapingu) — wszystkie oryginalne kolumny,
  // wszystkie oryginalne wiersze, plus dwie nowe kolumny na końcu. Ta sama
  // macierz zasila zarówno CSV, jak i XLSX, więc oba pliki są zawsze spójne.
  const header = [...fields, 'Zdanie ENG', 'Zdanie PL']
  const sheetRows: string[][] = [header]

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const sentence = sentenceByRow.get(i)
    const row = fields.map((f) => raw[f] ?? '')
    row.push(sentence?.sentenceEn ?? '')
    row.push(sentence?.sentencePl ?? '')
    sheetRows.push(row)
  }

  const csv = sheetRows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
  // BOM dla poprawnego wyświetlania polskich znaków w Excelu
  fs.writeFileSync(OUT_CSV_PATH, '﻿' + csv, 'utf-8')
  console.log(`\n✓ Wrote ${rawRows.length} data rows to ${OUT_CSV_PATH}`)

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
  worksheet['!cols'] = header.map((h) => {
    const maxLen = sheetRows.reduce((max, row) => {
      const cell = row[header.indexOf(h)]
      return Math.max(max, String(cell ?? '').length)
    }, h.length)
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) }
  })
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }) }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Baza słówek + zdania')
  XLSX.writeFile(workbook, OUT_XLSX_PATH)
  console.log(`✓ Wrote ${rawRows.length} data rows to ${OUT_XLSX_PATH}`)
}

main()
