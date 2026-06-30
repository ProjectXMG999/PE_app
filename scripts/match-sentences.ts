import XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const MIAMI_PATH = path.join(ROOT, 'database/database/SYSTEM SŁÓW MIAMI 25.09.2023 (tu są zdania do 1 poziomu) KOPIA')
const PACK_DIR = path.join(ROOT, 'src/data/packs')

interface MiamiRow {
  english: string
  sentenceEn: string | null
  sentencePl: string | null
}

function loadMiamiSentences(): Map<string, MiamiRow> {
  console.log('Loading Miami database...')

  let filePath = MIAMI_PATH
  if (!fs.existsSync(filePath)) {
    const xlsxPath = MIAMI_PATH + '.xlsx'
    if (fs.existsSync(xlsxPath)) filePath = xlsxPath
    else {
      console.error('Miami DB not found at:', MIAMI_PATH)
      return new Map()
    }
  }

  const data = fs.readFileSync(filePath)
  const wb = XLSX.read(data)

  // Try the main vocabulary sheet first, then fall back to first sheet
  const sheetName = wb.SheetNames.includes('SŁOWA GENERAL')
    ? 'SŁOWA GENERAL'
    : wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  console.log(`Miami sheet: ${sheetName}, rows: ${rows.length}`)
  if (rows.length === 0) return new Map()

  const keys = Object.keys(rows[0])
  console.log('Miami columns:', keys.slice(0, 12))

  const map = new Map<string, MiamiRow>()

  for (const row of rows) {
    // Miami uses 'word' column (not 'words')
    const english = String(row['word'] ?? row['words'] ?? row['Słowo ENG'] ?? row[keys[3]] ?? '').trim().toLowerCase()
    const sentenceEn = String(row['sentence_target'] ?? row['ZDANIA ENG'] ?? '').trim() || null
    const sentencePl = String(row['sentence_native_pl'] ?? row['ZDANIA PL'] ?? '').trim() || null

    if (english) {
      map.set(english, { english, sentenceEn, sentencePl })
    }
  }

  console.log(`Unique English words with sentences: ${map.size}`)
  return map
}

function main() {
  const sentenceMap = loadMiamiSentences()

  if (sentenceMap.size === 0) {
    console.log('No sentences loaded, skipping match step')
    return
  }

  const packFiles = fs.readdirSync(PACK_DIR).filter(f => f.endsWith('.json'))
  let matched = 0
  let total = 0

  for (const file of packFiles) {
    const packPath = path.join(PACK_DIR, file)
    const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'))
    let changed = false

    for (const word of pack.words) {
      total++
      const key = word.english.toLowerCase()
      const sentence = sentenceMap.get(key)
      if (sentence?.sentenceEn) {
        word.sentenceEn = sentence.sentenceEn
        word.sentencePl = sentence.sentencePl
        matched++
        changed = true
      }
    }

    if (changed) {
      fs.writeFileSync(packPath, JSON.stringify(pack, null, 2), 'utf-8')
    }
  }

  console.log(`\nMatched sentences: ${matched} / ${total} words (${Math.round(matched/total*100)}%)`)
}

main()
