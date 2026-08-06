import Papa from 'papaparse'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const CSV_PATH = path.join(ROOT, 'database/database/Baza Wizard (prawdopodobnie najnowsza baza, bez zdań) KOPIA  - Cała baza.csv')
const PACK_DIR = path.join(ROOT, 'src/data/packs')
const INDEX_PATH = path.join(ROOT, 'src/data/packages-index.json')
const OUT_PATH = path.join(ROOT, 'database/database/Baza Wizard + Zdania - Cała baza.csv')

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

  // Zapisz kopię: wszystkie oryginalne kolumny, wszystkie oryginalne wiersze,
  // plus dwie nowe kolumny na końcu.
  const outHeader = [...fields, 'Zdanie ENG', 'Zdanie PL']
  const outLines = [outHeader.map(csvEscape).join(',')]

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const original = fields.map((f) => csvEscape(raw[f]))
    const sentence = sentenceByRow.get(i)
    original.push(csvEscape(sentence?.sentenceEn ?? ''))
    original.push(csvEscape(sentence?.sentencePl ?? ''))
    outLines.push(original.join(','))
  }

  const csv = outLines.join('\r\n')
  // BOM dla poprawnego wyświetlania polskich znaków w Excelu
  fs.writeFileSync(OUT_PATH, '﻿' + csv, 'utf-8')

  console.log(`\n✓ Wrote ${rawRows.length} data rows to ${OUT_PATH}`)
}

main()
