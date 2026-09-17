import XLSX from 'xlsx'
import path from 'path'
import { ROOT } from './config.js'

// The owner's hand-reviewed master file — source of truth for human picks
// ("Wybrane") and audio notes. Read-only for every script: outputs go to a
// new version (candidates-master-v5.xlsx), never back into this file.
export const MASTER_BASE_PATH = path.join(ROOT, 'database/database/candidates-master-v3-update1.xlsx')
export const SHEET_NAME = 'Kandydaci zdań'

export type MasterRow = Record<string, string | number>

// A pick the pipeline must respect as final: a single candidate number.
// Anything else the owner typed ("-", "2?", "2.3") means "not decided" —
// those rows get AI selection, with the raw value passed along as a hint.
export function firmPick(row: MasterRow): number | null {
  const v = String(row['Wybrane'] ?? '').trim()
  return /^\d{1,2}$/.test(v) ? Number(v) : null
}

export function loadMaster(filePath = MASTER_BASE_PATH): { rows: MasterRow[]; columns: string[] } {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[SHEET_NAME]
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found in ${filePath}`)
  const rows = XLSX.utils.sheet_to_json<MasterRow>(sheet, { defval: '' })
  const columns = (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? []).map(String)
  return { rows, columns }
}

// Rows that correspond to a pack word, in the spreadsheet's Lp order — the
// order the owner means by "words 1-3000". It differs from pack-file order.
export function wordRowsByLp(rows: MasterRow[]): MasterRow[] {
  return rows.filter((r) => r['wordId']).sort((a, b) => Number(a['Lp']) - Number(b['Lp']))
}

// Where the 5 new (v9-prompt) candidates land for a row, by Lp position:
// words 1-3000 keep their old columns 1-6 (the owner may still prefer one),
// so the new ones go in 7-11; words 3001+ had their old candidates dropped,
// so the new ones start at 1. The selector and build-master-v5 must agree
// on this or an AI pick would point at the wrong column.
export const KEEP_OLD_CANDIDATES_UP_TO_POSITION = 3000
export const OLD_CANDIDATE_COLUMNS = 6

export function newCandidateStart(lpPosition: number): number {
  return lpPosition <= KEEP_OLD_CANDIDATES_UP_TO_POSITION ? OLD_CANDIDATE_COLUMNS + 1 : 1
}

export interface V9Record {
  candidate1Pl: string
  candidate1En: string
  candidate2Pl: string
  candidate2En: string
  candidate3Pl: string
  candidate3En: string
  candidate4Pl?: string
  candidate4En?: string
  candidate5Pl?: string
  candidate5En?: string
}

export function newCandidates(rec: V9Record, start: number): { n: number; pl: string; en: string }[] {
  const out: { n: number; pl: string; en: string }[] = []
  for (let i = 1; i <= 5; i++) {
    const pl = String((rec as Record<string, unknown>)[`candidate${i}Pl`] ?? '').trim()
    const en = String((rec as Record<string, unknown>)[`candidate${i}En`] ?? '').trim()
    if (pl || en) out.push({ n: start + i - 1, pl, en })
  }
  return out
}

// The pool the AI picks from, numbered exactly as it will appear in
// candidates-master-v5.xlsx. An empty "Wybrane" means the owner found none
// of the old candidates good enough, so only the new ones compete; old
// columns stay in the pool only when he left a note pointing at them
// ("2.3", "1?").
export function candidatePool(
  row: MasterRow,
  lpPosition: number,
  rec: V9Record | undefined
): { n: number; pl: string; en: string }[] {
  const start = newCandidateStart(lpPosition)
  // "-" is the owner's "none of these fit" — a note, but one that rules the
  // old candidates out rather than pointing at them.
  const note = String(row['Wybrane'] ?? '').trim()
  const hasNote = note !== '' && note !== '-'
  const old = start > 1 && hasNote ? candidatesOf(row).filter((c) => c.n <= OLD_CANDIDATE_COLUMNS) : []
  return [...old, ...(rec ? newCandidates(rec, start) : [])]
}

export function candidatesOf(row: MasterRow): { n: number; pl: string; en: string }[] {
  const out: { n: number; pl: string; en: string }[] = []
  for (let n = 1; n <= 20; n++) {
    const pl = String(row[`Zdanie PL ${n}`] ?? '').trim()
    const en = String(row[`Zdanie ENG ${n}`] ?? '').trim()
    if (pl || en) out.push({ n, pl, en })
  }
  return out
}
