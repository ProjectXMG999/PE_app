// Build database/database/candidates-master-v5.xlsx from the owner's
// hand-reviewed candidates-master-v3-update1.xlsx (never modified) plus:
// - new v9-prompt candidates from sentence-output/checkpoint-v9.jsonl —
//   words 1-3000 keep old columns 1-6 and get the new ones in 7-11; words
//   3001+ get the new ones in 1-5 with old candidates dropped (see
//   lib/masterSheet.ts#newCandidateStart);
// - AI picks from sentence-output/ai-picks.jsonl, in their own columns next
//   to the owner's "Wybrane" (which is copied through untouched):
//   "Wybór AI" (column number, or "brak — do przeglądu"), "Powód AI", and
//   "Wybrane PL" / "Wybrane ENG" with the chosen sentence text — the owner's
//   pick when there is one, otherwise the AI's.
//
// Usage: npm run gen-sentences:build-v5

import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { ROOT } from './sentences/lib/config.js'
import { loadAllRecords } from './sentences/lib/checkpoint.js'
import {
  loadMaster,
  wordRowsByLp,
  firmPick,
  candidatesOf,
  newCandidates,
  newCandidateStart,
  SHEET_NAME,
  type MasterRow,
  type V9Record,
} from './sentences/lib/masterSheet.js'

const OUT_PATH = path.join(ROOT, 'database/database/candidates-master-v5.xlsx')
const CHECKPOINT_V9 = path.join(ROOT, 'sentence-output/checkpoint-v9.jsonl')
const PICKS_PATH = path.join(ROOT, 'sentence-output/ai-picks.jsonl')
const AI_COLUMNS = ['Wybór AI', 'Powód AI', 'Wybrane PL', 'Wybrane ENG']
const CANDIDATE_COL = /^Zdanie (ENG|PL) (\d+)$/

interface PickRecord {
  wordId: string
  chosen: number
  reason: string
  chosenPl: string
  chosenEn: string
}

function readPicks(): Map<string, PickRecord> {
  const out = new Map<string, PickRecord>()
  if (!fs.existsSync(PICKS_PATH)) return out
  for (const line of fs.readFileSync(PICKS_PATH, 'utf-8').split('\n')) {
    if (!line.trim()) continue
    try {
      const p = JSON.parse(line) as PickRecord
      out.set(p.wordId, p)
    } catch {
      // skip a partial line
    }
  }
  return out
}

function main() {
  const { rows, columns } = loadMaster()
  const baseWybrane = new Map(rows.map((r) => [String(r['wordId'] ?? `lp-${r['Lp']}`), String(r['Wybrane'] ?? '')]))
  const positionOf = new Map(wordRowsByLp(rows).map((r, i) => [String(r['wordId']), i + 1]))
  const v9 = new Map<string, V9Record>(loadAllRecords(CHECKPOINT_V9).map((r) => [r.id, r]))
  const picks = readPicks()

  let maxCandidate = 6
  let newIn7to11 = 0
  let newIn1to5 = 0
  let aiChosen = 0
  let aiNone = 0

  for (const row of rows) {
    const id = String(row['wordId'] ?? '')
    if (!id) continue
    const position = positionOf.get(id)!
    const rec = v9.get(id)

    if (rec) {
      const start = newCandidateStart(position)
      if (start === 1) {
        for (const key of Object.keys(row)) if (CANDIDATE_COL.test(key)) row[key] = ''
        newIn1to5++
      } else {
        newIn7to11++
      }
      for (const c of newCandidates(rec, start)) {
        row[`Zdanie ENG ${c.n}`] = c.en
        row[`Zdanie PL ${c.n}`] = c.pl
        maxCandidate = Math.max(maxCandidate, c.n)
      }
    }

    const human = firmPick(row)
    const humanCand = human !== null ? candidatesOf(row).find((c) => c.n === human) : undefined
    const pick = picks.get(id)
    row['Wybór AI'] = ''
    row['Powód AI'] = ''
    if (pick && human === null) {
      if (pick.chosen > 0) aiChosen++
      else aiNone++
      row['Wybór AI'] = pick.chosen > 0 ? pick.chosen : 'brak — do przeglądu'
      row['Powód AI'] = pick.reason
    }
    const finalCand = humanCand ?? (pick && human === null && pick.chosen > 0 ? { pl: pick.chosenPl, en: pick.chosenEn } : undefined)
    row['Wybrane PL'] = finalCand?.pl ?? ''
    row['Wybrane ENG'] = finalCand?.en ?? ''
  }

  // Column order: original columns, AI columns right after "Wybrane", the
  // full run of candidate pairs (1..max) where the candidates used to start.
  const before: string[] = []
  const after: string[] = []
  let seenCandidates = false
  for (const col of columns) {
    if (CANDIDATE_COL.test(col)) {
      seenCandidates = true
      continue
    }
    ;(seenCandidates ? after : before).push(col)
    if (col === 'Wybrane') before.push(...AI_COLUMNS)
  }
  const candidateCols: string[] = []
  for (let n = 1; n <= maxCandidate; n++) candidateCols.push(`Zdanie ENG ${n}`, `Zdanie PL ${n}`)
  const header = [...before, ...candidateCols, ...after]

  const aoa: (string | number)[][] = [header]
  for (const row of rows) aoa.push(header.map((h) => (row[h] ?? '') as string | number))

  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  sheet['!cols'] = header.map((h, i) => {
    const maxLen = aoa.slice(0, 400).reduce((m, r) => Math.max(m, String(r[i] ?? '').length), h.length)
    return { wch: Math.min(Math.max(maxLen + 2, 8), 60) }
  })
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }) }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME)
  XLSX.writeFile(workbook, OUT_PATH)

  // Verify the owner's picks came through untouched.
  const written = loadMaster(OUT_PATH).rows
  const changed = written.filter(
    (r) => String(r['Wybrane'] ?? '') !== baseWybrane.get(String(r['wordId'] ?? `lp-${r['Lp']}`))
  ).length

  console.log(`✓ ${path.relative(ROOT, OUT_PATH)}`)
  console.log(`  new candidates: ${newIn7to11} words in columns 7-11 (Lp 1-3000), ${newIn1to5} words in columns 1-5 (Lp 3001+)`)
  console.log(`  AI picks: ${aiChosen} chosen, ${aiNone} "brak — do przeglądu"`)
  console.log(`  "Wybrane" rows differing from v3-update1: ${changed} (must be 0)`)
}

main()
