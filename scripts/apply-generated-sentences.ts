// Write ONE of the 3 generated candidates into src/data/packs/*.json,
// replacing whatever sentence (if any) is currently there.
//
// This applies the SAME candidate index to every word (--candidate=1|2|3,
// default 1) — useful to test the pipeline end-to-end or to bulk-apply a
// single pass. For the real "pick the best of 3 per word" workflow, review
// sentence-output/candidates-master.xlsx (npm run gen-sentences:master-export),
// then apply per-word choices from that review (not yet automated here —
// this script currently only supports one global candidate index).
//
// Usage:
//   npm run gen-sentences:apply -- --candidate=1
//   npm run gen-sentences:apply -- --candidate=2 --dry-run

import fs from 'fs'
import { loadConfig } from './sentences/lib/config.js'
import { loadAllRecords } from './sentences/lib/checkpoint.js'
import { loadPackFiles } from './sentences/lib/wordSource.js'
import type { CheckpointRecord } from './sentences/lib/types.js'

function pickCandidate(record: CheckpointRecord, n: number): { en: string; pl: string } {
  switch (n) {
    case 2:
      return { en: record.candidate2En, pl: record.candidate2Pl }
    case 3:
      return { en: record.candidate3En, pl: record.candidate3Pl }
    default:
      return { en: record.candidate1En, pl: record.candidate1Pl }
  }
}

function main() {
  const config = loadConfig(process.argv.slice(2))
  if (![1, 2, 3].includes(config.candidate)) {
    console.error(`--candidate must be 1, 2, or 3 (got ${config.candidate})`)
    process.exit(1)
  }

  const records = loadAllRecords(config.checkpointPath)
  if (records.length === 0) {
    console.log(`No generated sentences found at ${config.checkpointPath}. Run gen-sentences first.`)
    return
  }

  // Keep only the latest record per word id (a word can appear more than
  // once in the checkpoint if a batch was regenerated).
  const byId = new Map<string, CheckpointRecord>()
  for (const r of records) byId.set(r.id, r)

  const packFiles = loadPackFiles(config.packDir)
  let updated = 0
  let filesChanged = 0

  for (const { file, pack } of packFiles) {
    let changedInFile = 0
    for (const word of pack.words) {
      const record = byId.get(word.id)
      if (!record) continue
      const chosen = pickCandidate(record, config.candidate)
      if (word.sentenceEn === chosen.en && word.sentencePl === chosen.pl) continue
      word.sentenceEn = chosen.en
      word.sentencePl = chosen.pl
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
    `${config.dryRun ? '[dry run] would update' : 'Updated'} ${updated} words (candidate ${config.candidate}) across ${filesChanged} pack files.`
  )

  if (!config.dryRun) {
    const verifyPacks = loadPackFiles(config.packDir)
    let mismatches = 0
    for (const { pack } of verifyPacks) {
      for (const word of pack.words) {
        const record = byId.get(word.id)
        if (!record) continue
        const chosen = pickCandidate(record, config.candidate)
        if (word.sentenceEn !== chosen.en || word.sentencePl !== chosen.pl) mismatches++
      }
    }
    console.log(mismatches === 0 ? 'Verification passed.' : `Verification found ${mismatches} mismatches.`)
  }
}

main()
