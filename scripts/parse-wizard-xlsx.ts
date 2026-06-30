import XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const XLSX_PATH = path.join(ROOT, 'database/database/Baza Wizard (prawdopodobnie najnowsza baza, bez zdań) KOPIA .xlsx')
const OUT_DIR = path.join(ROOT, 'src/data/packs')
const INDEX_PATH = path.join(ROOT, 'src/data/packages-index.json')

interface WizardRow {
  id?: number
  level?: number | string
  volume?: string
  chapter?: string
  category?: string
  packName?: string
  english?: string
  polish?: string
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, c => ({ ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z' }[c] ?? c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function main() {
  console.log('Reading Wizard XLSX...')
  const data = fs.readFileSync(XLSX_PATH)
  const wb = XLSX.read(data)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  console.log(`Total rows: ${rows.length}`)
  console.log('First row keys:', Object.keys(rows[0] ?? {}))

  // Detect column mapping from first row
  const keys = Object.keys(rows[0] ?? {})
  console.log('Columns:', keys)

  // Parse rows into typed objects
  // Wizard columns: Lp, Poziom, Tom, Rozdział, Jednostka, Nazwa paczki, Słowo ENG, Tłumaczenie PL
  const parsed: WizardRow[] = rows.map((r) => ({
    id: Number(r['Lp'] ?? r[keys[0]]) || undefined,
    level: r['Poziom'] ?? r[keys[1]],
    volume: String(r['Tom'] ?? r[keys[2]] ?? ''),
    chapter: String(r['Rozdział'] ?? r[keys[3]] ?? ''),
    category: String(r['Jednostka'] ?? r[keys[4]] ?? ''),
    packName: String(r['Nazwa paczki'] ?? r[keys[5]] ?? ''),
    english: String(r['Słowo ENG'] ?? r[keys[6]] ?? '').trim(),
    polish: String(r['Tłumaczenie PL'] ?? r[keys[7]] ?? '').trim(),
  }))

  // Filter Tom I only
  const tomI = parsed.filter(r =>
    r.volume?.toLowerCase().includes('tom i') ||
    r.volume?.toLowerCase() === 'tom i' ||
    r.volume?.match(/\btom\s*1\b/i) != null
  )

  console.log(`Tom I rows: ${tomI.length}`)

  if (tomI.length === 0) {
    console.log('No Tom I rows found. Check volume values:')
    const volumes = [...new Set(parsed.map(r => r.volume))].slice(0, 20)
    console.log(volumes)

    // Try all packs if filtering fails
    console.log('Using all rows for demo...')
    const allRows = parsed.filter(r => r.english && r.polish)
    processRows(allRows.slice(0, 1100))
    return
  }

  processRows(tomI)
}

function processRows(rows: WizardRow[]) {
  // Group by pack name
  const packs = new Map<string, WizardRow[]>()
  for (const row of rows) {
    if (!row.english || !row.polish) continue
    const packName = row.packName || `${row.category} ${row.chapter}`
    if (!packs.has(packName)) packs.set(packName, [])
    packs.get(packName)!.push(row)
  }

  console.log(`Unique packs: ${packs.size}`)

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }

  const packIndex: {
    id: string
    name: string
    volume: string
    level: number
    category: string
    wordCount: number
    chapter: string
  }[] = []

  let packNum = 0
  for (const [packName, words] of packs) {
    packNum++
    const id = `t1-p${String(packNum).padStart(2, '0')}`
    const firstWord = words[0]
    const level = Number(firstWord?.level) || 1
    const category = firstWord?.category || 'Inne'
    const volume = firstWord?.volume || 'Tom I'
    const chapter = firstWord?.chapter || ''

    const packData = {
      id,
      name: packName,
      volume,
      level,
      category,
      chapter,
      words: words.map((w, i) => ({
        id: `${id}-${String(i + 1).padStart(3, '0')}`,
        english: w.english!,
        polish: w.polish!,
        sentenceEn: null as string | null,
        sentencePl: null as string | null,
        audioWord: `${id}-${String(i + 1).padStart(3, '0')}-word.mp3`,
        audioSentence: `${id}-${String(i + 1).padStart(3, '0')}-sentence.mp3`,
      })),
    }

    fs.writeFileSync(
      path.join(OUT_DIR, `${id}.json`),
      JSON.stringify(packData, null, 2),
      'utf-8'
    )

    packIndex.push({
      id,
      name: packName,
      volume,
      level,
      category,
      wordCount: words.length,
      chapter,
    })
  }

  fs.writeFileSync(INDEX_PATH, JSON.stringify(packIndex, null, 2), 'utf-8')
  console.log(`\nWrote ${packNum} packs to ${OUT_DIR}`)
  console.log(`Wrote index to ${INDEX_PATH}`)
}

main()
