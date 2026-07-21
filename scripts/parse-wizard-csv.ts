import Papa from 'papaparse'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const CSV_PATH = path.join(ROOT, 'database/database/Baza Wizard (prawdopodobnie najnowsza baza, bez zdań) KOPIA  - Cała baza.csv')
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

// Normalizatory dla audio TTS
const ACRONYM_DICT: Record<string, string> = {
  // Cyfro-literowe skróty
  'B4': 'B four',
  'B4n': 'B four N',
  'G2g': 'G T G',
  'L8r': 'Later',
  'W8': 'Wait',
  '4u': 'For you',
  'M8': 'Mate',
  'U2': 'You too',
  'H8': 'Hate',
  'J4f': 'Just for fun',
  'B2b': 'B two B',
  'B2c': 'B two C',
  'P2p': 'P two P',

  // Leet speak
  'W00t': 'Woot',
  'L337 h4x0r': 'Leet hacker',

  // @ znaki
  'B@u': 'Back at you',

  // Polskie słowa w ENG (błędy danych)
  'PRAWDA': 'True',
  'FAŁSZ': 'False',
  'Sklasyfikowany; tajny': 'Classified',
}

function normalizeEnglishForAudio(word: string, category: string): string {
  // 1. Usuń non-breaking spaces
  word = word.replace(/\xa0/g, ' ').trim()

  // 2. Zamień słownik
  if (ACRONYM_DICT[word]) {
    return ACRONYM_DICT[word]
  }

  // 3. Skróty -> WIELKIE LITERY (jednostka "Skróty")
  if (category === 'Skróty' || category === 'Skrót') {
    // Sprawdź czy to już akronim (same wielkie lub mix)
    // Jeśli nie, zamień na wielkie (Title Case -> CAPS)
    if (!/^[A-Z0-9\-\.\/\s]+$/.test(word) && word.length > 1) {
      // Title Case (Asap) -> ASAP
      const allCaps = word.toUpperCase()
      return allCaps
    }
  }

  // 4. Zamień @ na "at"
  if (word.includes('@')) {
    word = word.replace(/@/g, 'at')
  }

  // 5. Napraw leet speak (pojedyncze 0 w słowach)
  if (word.includes('0')) {
    // Zapamiętaj, że W00t jest już w ACRONYM_DICT
    // Inne przypadki: nie zmieniaj (może to być celowe)
  }

  return word
}

function normalizePolishForAudio(translation: string): string {
  // 1. Usuń non-breaking spaces
  translation = translation.replace(/\xa0/g, ' ')

  // 2. Trim (usuń trailing spaces)
  translation = translation.trim()

  // 3. Tylko pierwsze znaczenie (przed pierwszym średnikiem)
  if (translation.includes(';')) {
    translation = translation.split(';')[0].trim()
  }

  // 4. Usuń zawartość nawiasów (wyjaśnienia kontekstowe)
  translation = translation.replace(/\s*\(.*?\)/g, '').trim()

  // 5. Ukośniki: "sam/sama" -> "sam lub sama"
  translation = translation.replace(/(\w+)\/(\w+)/g, '$1 lub $2')

  // 6. Napraw urwane tłumaczenia (kończące się przecinkami itp.)
  if (translation.endsWith(',')) {
    translation = translation.slice(0, -1).trim()
  }

  return translation
}

function fixRodzialTypo(chapter: string): string {
  // Literówka: "Rodział" -> "Rozdział"
  return chapter.replace(/^Rodział\s+/i, 'Rozdział ')
}

function main() {
  console.log('Reading Wizard CSV...')
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')

  // Papa Parse z obsługą wieloliniowych pól
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  if (parsed.errors.length > 0) {
    console.warn('CSV Parse warnings:', parsed.errors)
  }

  const rows = parsed.data as Record<string, unknown>[]
  console.log(`Total rows: ${rows.length}`)
  console.log('First row keys:', Object.keys(rows[0] ?? {}))

  // Mapuj kolumny CSV
  const mapped: WizardRow[] = rows.map((r) => {
    const level = String(r['Poziom'] ?? '').trim()
    const volume = String(r['Tom'] ?? '').trim()
    const chapter = String(r['Rozdział'] ?? '').trim()
    const category = String(r['Jednostka'] ?? '').trim()
    const packName = String(r['Nazwa paczki'] ?? '').trim()
    const english = String(r['Słowo ENG'] ?? '').trim()
    const polish = String(r['Tłumaczenie PL'] ?? '').trim()

    return {
      id: Number(r['Lp'] ?? 0) || undefined,
      level: Number(level) || undefined,
      volume,
      chapter: fixRodzialTypo(chapter),
      category,
      packName,
      english,
      polish,
    }
  })

  // Filtruj: tylko wiersze z angielskim i polskim
  const validRows = mapped.filter(r => r.english && r.polish && r.packName)
  console.log(`Valid rows (with ENG + PL + pack name): ${validRows.length}`)

  processRows(validRows)
}

function processRows(rows: WizardRow[]) {
  // Grupuj po nazwie paczki
  const packs = new Map<string, WizardRow[]>()
  for (const row of rows) {
    if (!row.english || !row.polish || !row.packName) continue

    // Mapuj kategorie: "Zabronione" -> "Slang"
    let category = row.category || 'Inne'
    if (category === 'Zabronione') {
      category = 'Slang'
    }

    // Aktualizuj kategorię w row
    row.category = category

    // Poziomy z CSV są używane bezpośrednio: 1=Tom I (World-Class), 4=Tom IX (Survival)

    if (!packs.has(row.packName)) packs.set(row.packName, [])
    packs.get(row.packName)!.push(row)
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
  const stats = {
    totalWords: 0,
    audioNormalizedEN: 0,
    audioNormalizedPL: 0,
  }

  for (const [packName, words] of packs) {
    packNum++
    const id = `t1-p${String(packNum).padStart(3, '0')}`
    const firstWord = words[0]
    const level = firstWord?.level || 1
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
      words: words.map((w, i) => {
        const normalizedEn = normalizeEnglishForAudio(w.english!, w.category || '')
        const normalizedPl = normalizePolishForAudio(w.polish!)

        // Liczy normalizacje
        if (normalizedEn !== w.english!) stats.audioNormalizedEN++
        if (normalizedPl !== w.polish!) stats.audioNormalizedPL++
        stats.totalWords++

        return {
          id: `${id}-${String(i + 1).padStart(3, '0')}`,
          english: normalizedEn,
          polish: normalizedPl,
          sentenceEn: null as string | null,
          sentencePl: null as string | null,
          audioWord: `${id}-${String(i + 1).padStart(3, '0')}-word.mp3`,
          audioSentence: `${id}-${String(i + 1).padStart(3, '0')}-sentence.mp3`,
        }
      }),
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

  console.log(`\n✓ Wrote ${packNum} packs to ${OUT_DIR}`)
  console.log(`✓ Wrote index to ${INDEX_PATH}`)
  console.log(`\n📊 Statistics:`)
  console.log(`   Total words: ${stats.totalWords}`)
  console.log(`   English words normalized for audio: ${stats.audioNormalizedEN}`)
  console.log(`   Polish translations normalized for audio: ${stats.audioNormalizedPL}`)
  console.log(`   Packs created: ${packNum}`)
}

main()
