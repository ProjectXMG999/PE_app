// Generate an EXTRA round of 3 candidate sentences for specific words that
// already went through the normal pipeline but still have no "Wybrane" pick
// — i.e. none of the existing candidates (columns 1-3, or 1-6 if a manual
// second round was pasted in) were good enough. Writes the new candidates
// directly into the next free "Zdanie ENG N / Zdanie PL N" column pair in
// the given xlsx file, in place — everything else in the file is left
// untouched. Because checkpoint.jsonl only has room for one round of 3
// candidates per word id, this bypasses the checkpoint entirely; the next
// gen-sentences:master-export run picks these columns up automatically via
// its generic "carry forward extra columns" logic (same mechanism that
// already preserves manually-added columns 4-6).
//
// Usage:
//   npm run gen-sentences:extra-round -- --xlsx="database/database/candidates-master-v3.xlsx" --max-position=1000
//   npm run gen-sentences:extra-round -- --xlsx=... --max-position=1000 --dry-run

import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { loadConfig, ROOT } from './sentences/lib/config.js'
import { loadPackFiles } from './sentences/lib/wordSource.js'
import { chunkByPack } from './sentences/lib/batching.js'
import { createClient, generateBatch } from './sentences/lib/openaiClient.js'
import { createLimiter } from './sentences/lib/limiter.js'
import { CostTracker } from './sentences/lib/costTracker.js'
import { RepetitionTracker } from './sentences/lib/repetitionTracker.js'
import type { WordTask } from './sentences/lib/types.js'

const SHEET_NAME = 'Kandydaci zdań'

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq === -1) out[arg.slice(2)] = true
    else out[arg.slice(2, eq)] = arg.slice(eq + 1)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const xlsxPath = path.join(ROOT, String(args.xlsx ?? ''))
  const maxPosition = Number(args['max-position'] ?? Infinity)
  const dryRun = Boolean(args['dry-run'])
  if (!args.xlsx || !fs.existsSync(xlsxPath)) {
    console.error('Pass --xlsx=<path relative to repo root> pointing at an existing review file.')
    process.exit(1)
  }

  const workbook = XLSX.readFile(xlsxPath)
  const sheet = workbook.Sheets[SHEET_NAME]
  if (!sheet) {
    console.error(`Sheet "${SHEET_NAME}" not found in ${xlsxPath}`)
    process.exit(1)
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  // Find the next 3 free candidate column numbers (existing files may
  // already have 1-3 from generation and 4-6 from a manual second round) —
  // a fresh full triplet (modern/micro-emotion/spoken), same shape as every
  // earlier round, not just a single column.
  const existingCandidateCols = new Set<number>()
  for (const col of Object.keys(rows[0] ?? {})) {
    const m = col.match(/^Zdanie ENG (\d+)$/)
    if (m) existingCandidateCols.add(Number(m[1]))
  }
  const startN = existingCandidateCols.size > 0 ? Math.max(...existingCandidateCols) + 1 : 1
  const cols = [1, 2, 3].map((offset) => ({
    n: startN + offset - 1,
    en: `Zdanie ENG ${startN + offset - 1}`,
    pl: `Zdanie PL ${startN + offset - 1}`,
  }))

  const withCandidates = rows.filter((r) => r['wordId'] && r['Zdanie ENG 1'])
  withCandidates.sort((a, b) => Number(a['Lp']) - Number(b['Lp']))
  const inRange = withCandidates.slice(0, Number.isFinite(maxPosition) ? maxPosition : withCandidates.length)
  const targetRows = inRange.filter((r) => !r['Wybrane'])
  const targetIds = new Set(targetRows.map((r) => String(r['wordId'])))

  console.log(
    `${targetIds.size} words without "Wybrane" among the first ${inRange.length} generated (by Lp) — writing to new columns ${cols.map((c) => c.en).join(', ')}`
  )
  if (targetIds.size === 0) {
    console.log('Nothing to do.')
    return
  }

  const config = loadConfig([])
  const packFiles = loadPackFiles(config.packDir)
  const tasks: WordTask[] = []
  for (const { pack } of packFiles) {
    for (const w of pack.words) {
      if (targetIds.has(w.id)) {
        tasks.push({
          id: w.id,
          english: w.english,
          polish: w.polish,
          category: pack.category,
          level: pack.level,
          packId: pack.id,
          packName: pack.name,
        })
      }
    }
  }
  console.log(`Resolved ${tasks.length}/${targetIds.size} target ids against pack data`)

  if (dryRun) {
    console.log('Dry run — no API calls made.')
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('OPENAI_API_KEY env var not set (add it to .env)')
    process.exit(1)
  }

  const client = createClient(apiKey, 90_000, 3)
  const limiter = createLimiter(config.concurrency)
  const cost = new CostTracker(config.model, config.pricingOverride)
  const repetitionTracker = new RepetitionTracker()
  const batches = chunkByPack(tasks, config.batchSize)
  const resultsById = new Map<string, { candidate1: { en: string; pl: string }; candidate2: { en: string; pl: string }; candidate3: { en: string; pl: string } }>()

  let done = 0
  await Promise.all(
    batches.map((batch) =>
      limiter(async () => {
        try {
          const avoidWords = repetitionTracker.overusedWords()
          const result = await generateBatch(client, config.model, batch, avoidWords)
          cost.add(result.usage)
          for (const s of result.batch.sentences) {
            resultsById.set(s.id, {
              candidate1: { en: s.candidate1.sentenceEn, pl: s.candidate1.sentencePl },
              candidate2: { en: s.candidate2.sentenceEn, pl: s.candidate2.sentencePl },
              candidate3: { en: s.candidate3.sentenceEn, pl: s.candidate3.sentencePl },
            })
          }
          for (const w of batch) {
            const r = resultsById.get(w.id)
            if (r) {
              repetitionTracker.addRecord({
                candidate1En: r.candidate1.en,
                candidate2En: r.candidate2.en,
                candidate3En: r.candidate3.en,
                english: w.english,
              })
            }
          }
          done += batch.length
          console.log(`[${done}/${tasks.length}] ${cost.summary()}`)
        } catch (err) {
          console.error(`Batch failed (${batch.map((w) => w.id).join(', ')}):`, err instanceof Error ? err.message : err)
        }
      })
    )
  )

  console.log(`\nGenerated ${resultsById.size}/${tasks.length} extra candidate sets. ${cost.summary()}`)

  for (const row of rows) {
    const wordId = String(row['wordId'] ?? '')
    const extra = resultsById.get(wordId)
    if (extra) {
      row[cols[0].en] = extra.candidate1.en
      row[cols[0].pl] = extra.candidate1.pl
      row[cols[1].en] = extra.candidate2.en
      row[cols[1].pl] = extra.candidate2.pl
      row[cols[2].en] = extra.candidate3.en
      row[cols[2].pl] = extra.candidate3.pl
    }
  }

  const newSheet = XLSX.utils.json_to_sheet(rows)
  workbook.Sheets[SHEET_NAME] = newSheet
  XLSX.writeFile(workbook, xlsxPath)
  console.log(`✓ Wrote extra candidates into ${cols.map((c) => `${c.en}/${c.pl}`).join(', ')} in ${xlsxPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
