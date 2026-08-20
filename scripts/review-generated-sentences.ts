// Export everything generated so far into a flat CSV for a quick look (open
// in Excel/Sheets): id, word, and the 3 candidate EN/PL pairs (6 sentence
// columns), one row per word. For a version merged into a copy of the full
// master word database (all original columns + these 6), use
// gen-sentences:master-export instead.
//
// Usage: npm run gen-sentences:review

import fs from 'fs'
import path from 'path'
import { loadConfig } from './sentences/lib/config.js'
import { loadAllRecords } from './sentences/lib/checkpoint.js'

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

  const rows = [
    [
      'id',
      'packId',
      'packName',
      'category',
      'level',
      'english',
      'polish',
      'sentenceEn_1',
      'sentencePl_1',
      'sentenceEn_2',
      'sentencePl_2',
      'sentenceEn_3',
      'sentencePl_3',
      'model',
      'generatedAt',
    ],
  ]
  for (const r of records) {
    rows.push([
      r.id,
      r.packId,
      r.packName,
      r.category,
      String(r.level),
      r.english,
      r.polish,
      r.candidate1En,
      r.candidate1Pl,
      r.candidate2En,
      r.candidate2Pl,
      r.candidate3En,
      r.candidate3Pl,
      r.model,
      r.generatedAt,
    ])
  }

  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
  const outPath = path.join(path.dirname(config.checkpointPath), 'review.csv')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  // BOM for correct Polish diacritics display in Excel
  fs.writeFileSync(outPath, '﻿' + csv, 'utf-8')
  console.log(`Exported ${records.length} generated words (3 candidates each) to ${outPath}`)
}

main()
