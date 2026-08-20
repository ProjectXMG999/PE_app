// Read sentence-output/candidates-master.xlsx after you've filled in the
// "Wybrane" column (1, 2, or 3 per word) and write the chosen sentence into
// src/data/packs/*.json. Reads the live cell content for the chosen
// candidate — if you hand-edited a sentence in Excel instead of just
// picking one of the three as-is, that edit is what gets applied.
//
// Rows with an empty or invalid "Wybrane" are skipped (left untouched, so
// you can apply in passes as you work through the review).
//
// Usage:
//   npm run gen-sentences:apply-chosen
//   npm run gen-sentences:apply-chosen -- --dry-run

import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import { loadConfig, ROOT } from './sentences/lib/config.js'
import { loadPackFiles } from './sentences/lib/wordSource.js'

const MASTER_XLSX_PATH = path.join(ROOT, 'sentence-output/candidates-master.xlsx')
const SHEET_NAME = 'Kandydaci zdań'

interface ChosenSentence {
  sentenceEn: string
  sentencePl: string
}

function readChoices(xlsxPath: string): Map<string, ChosenSentence> {
  const workbook = XLSX.readFile(xlsxPath)
  const sheet = workbook.Sheets[SHEET_NAME]
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found in ${xlsxPath}`)

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const choices = new Map<string, ChosenSentence>()
  let undecided = 0
  let invalid = 0

  for (const row of rows) {
    const wordId = String(row['wordId'] ?? '').trim()
    if (!wordId) continue

    const chosenRaw = String(row['Wybrane'] ?? '').trim()
    if (!chosenRaw) {
      undecided++
      continue
    }
    const n = Number(chosenRaw)
    if (![1, 2, 3].includes(n)) {
      invalid++
      console.warn(`  ⚠ ${wordId}: "Wybrane" = "${chosenRaw}" is not 1/2/3 — skipped`)
      continue
    }

    const sentenceEn = String(row[`Zdanie ENG ${n}`] ?? '').trim()
    const sentencePl = String(row[`Zdanie PL ${n}`] ?? '').trim()
    if (!sentenceEn || !sentencePl) {
      invalid++
      console.warn(`  ⚠ ${wordId}: candidate ${n} has an empty sentence — skipped`)
      continue
    }
    choices.set(wordId, { sentenceEn, sentencePl })
  }

  console.log(`Decided: ${choices.size}, undecided (blank): ${undecided}, invalid: ${invalid}`)
  return choices
}

function main() {
  const config = loadConfig(process.argv.slice(2))

  if (!fs.existsSync(MASTER_XLSX_PATH)) {
    console.log(`${MASTER_XLSX_PATH} not found. Run gen-sentences:master-export first.`)
    return
  }

  const choices = readChoices(MASTER_XLSX_PATH)
  if (choices.size === 0) {
    console.log('No decided rows ("Wybrane" filled in) found — nothing to apply.')
    return
  }

  const packFiles = loadPackFiles(config.packDir)
  let updated = 0
  let filesChanged = 0

  for (const { file, pack } of packFiles) {
    let changedInFile = 0
    for (const word of pack.words) {
      const chosen = choices.get(word.id)
      if (!chosen) continue
      if (word.sentenceEn === chosen.sentenceEn && word.sentencePl === chosen.sentencePl) continue
      word.sentenceEn = chosen.sentenceEn
      word.sentencePl = chosen.sentencePl
      changedInFile++
      updated++
    }
    if (changedInFile > 0) {
      filesChanged++
      if (!config.dryRun) {
        fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n')
      }
    }
  }

  console.log(
    `${config.dryRun ? '[dry run] would update' : 'Updated'} ${updated} words across ${filesChanged} pack files.`
  )

  if (!config.dryRun) {
    const verifyPacks = loadPackFiles(config.packDir)
    let mismatches = 0
    for (const { pack } of verifyPacks) {
      for (const word of pack.words) {
        const chosen = choices.get(word.id)
        if (!chosen) continue
        if (word.sentenceEn !== chosen.sentenceEn || word.sentencePl !== chosen.sentencePl) mismatches++
      }
    }
    console.log(mismatches === 0 ? 'Verification passed.' : `Verification found ${mismatches} mismatches.`)
  }
}

main()
