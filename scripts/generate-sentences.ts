// Generate 3 candidate EN/PL example sentences per vocabulary word, using
// OpenAI in concurrent batches. Every word in scope is regenerated from
// scratch — an existing sentence in the pack JSON is never treated as
// "done" and is left untouched until you explicitly apply a chosen
// candidate (apply-generated-sentences.ts). Safe to interrupt and re-run:
// this pipeline's own checkpoint is skipped on resume, so scaling a run
// from a 1k-word sample up to the full ~13k is just re-running with a
// bigger --limit / --all.
//
// Usage:
//   npm run gen-sentences                        # first 1000 words (sample)
//   npm run gen-sentences -- --limit=1000         # explicit sample size
//   npm run gen-sentences -- --all                # process every word in scope
//   npm run gen-sentences -- --packs=t1-p001,t1-p002
//   npm run gen-sentences -- --only-missing       # skip words that already have a sentence
//   npm run gen-sentences -- --model=gpt-5-mini --batch-size=20 --concurrency=6
//   npm run gen-sentences -- --dry-run            # preview the word list, no API calls
//
// After a run:
//   npm run gen-sentences:review                  # -> sentence-output/review.csv (6 sentence columns)
//   npm run gen-sentences:master-export           # -> sentence-output/candidates-master.xlsx
//                                                    (copy of the master word DB + the 6 new columns,
//                                                     indexed by word id, ready to pick the best of 3)
// and once a candidate is picked per word:
//   npm run gen-sentences:apply -- --candidate=1  # writes the chosen candidate into src/data/packs/*.json

import fs from 'fs'
import path from 'path'
import { loadConfig } from './sentences/lib/config.js'
import { loadPackFiles, collectWordTasks } from './sentences/lib/wordSource.js'
import { chunkByPack } from './sentences/lib/batching.js'
import { loadAllRecords, loadCompletedIds, appendRecords } from './sentences/lib/checkpoint.js'
import { createClient, generateBatch } from './sentences/lib/openaiClient.js'
import { createLimiter } from './sentences/lib/limiter.js'
import { CostTracker } from './sentences/lib/costTracker.js'
import { RepetitionTracker } from './sentences/lib/repetitionTracker.js'
import type { CheckpointRecord, WordTask } from './sentences/lib/types.js'

// A --limit sample is a word count, but requests are grouped whole-pack
// (see lib/batching.ts). Extend a limited slice to finish whichever pack it
// landed in the middle of, so a run never splits one pack's words across
// two separate CLI invocations (which would lose the "no duplicate
// sentence function within a pack" context for that pack).
function extendToWholePack(all: WordTask[], limit: number): WordTask[] {
  if (!Number.isFinite(limit) || limit >= all.length) return all
  let end = limit
  const lastPackId = all[end - 1]?.packId
  while (end < all.length && all[end].packId === lastPackId) end++
  return all.slice(0, end)
}

async function main() {
  const config = loadConfig(process.argv.slice(2))
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey && !config.dryRun) {
    console.error('OPENAI_API_KEY env var not set (add it to .env)')
    process.exit(1)
  }

  const packFiles = loadPackFiles(config.packDir, config.packFilter)
  const inScope = collectWordTasks(packFiles, config.onlyMissing)
  // Resume support for THIS pipeline's own progress (distinct from the pack
  // JSON's sentenceEn/sentencePl, which are ignored above by design).
  const completedIds = loadCompletedIds(config.checkpointPath)
  const remaining = inScope.filter((w) => !completedIds.has(w.id))

  console.log(
    `Words in scope: ${inScope.length} total, ${completedIds.size} already generated in a previous run, ${remaining.length} remaining`
  )

  const todo: WordTask[] = extendToWholePack(remaining, config.limit)
  if (todo.length === 0) {
    console.log('Nothing to do.')
    return
  }

  console.log(
    `This run: ${todo.length} words x 3 candidates — model=${config.model} batch-size=${config.batchSize} concurrency=${config.concurrency}`
  )

  if (config.dryRun) {
    console.log('Dry run — no API calls made. First batch preview:')
    console.log(JSON.stringify(todo.slice(0, config.batchSize), null, 2))
    return
  }

  const client = createClient(apiKey!, 90_000, 3)
  const limiter = createLimiter(config.concurrency)
  const cost = new CostTracker(config.model, config.pricingOverride)
  const batches = chunkByPack(todo, config.batchSize)

  // Seeded from whatever this checkpoint already has (earlier packs in this
  // same run, or a resumed prior run) so "already overused" carries across
  // the whole base, not just within one pack's request. Each batch reads
  // overusedWords() fresh right before its API call — since the limiter
  // only lets `concurrency` batches run at once, later-starting batches see
  // everything completed so far, including from earlier in this same run.
  const repetitionTracker = new RepetitionTracker()
  repetitionTracker.seed(loadAllRecords(config.checkpointPath))

  let done = 0
  let failedBatches = 0
  const startedAt = Date.now()

  await Promise.all(
    batches.map((batch) =>
      limiter(async () => {
        try {
          const avoidWords = repetitionTracker.overusedWords()
          const result = await generateBatch(client, config.model, batch, avoidWords)
          cost.add(result.usage)

          const byId = new Map(result.batch.sentences.map((s) => [s.id, s]))
          const records: CheckpointRecord[] = batch.map((w) => {
            const s = byId.get(w.id)!
            return {
              id: w.id,
              english: w.english,
              polish: w.polish,
              packId: w.packId,
              packName: w.packName,
              category: w.category,
              level: w.level,
              candidate1En: s.candidate1.sentenceEn,
              candidate1Pl: s.candidate1.sentencePl,
              candidate2En: s.candidate2.sentenceEn,
              candidate2Pl: s.candidate2.sentencePl,
              candidate3En: s.candidate3.sentenceEn,
              candidate3Pl: s.candidate3.sentencePl,
              model: config.model,
              generatedAt: new Date().toISOString(),
            }
          })
          appendRecords(config.checkpointPath, records)
          for (const r of records) repetitionTracker.addRecord(r)

          done += batch.length
          const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(0)
          console.log(`[${done}/${todo.length}] ${elapsedSec}s elapsed — ${cost.summary()}`)
        } catch (err) {
          failedBatches++
          const msg = `Batch failed (${batch.length} words: ${batch.map((w) => w.id).join(', ')}): ${
            err instanceof Error ? err.message : String(err)
          }`
          console.error(msg)
          fs.mkdirSync(path.dirname(config.errorLogPath), { recursive: true })
          fs.appendFileSync(config.errorLogPath, msg + '\n')
        }
      })
    )
  )

  console.log(`\nDone. Generated ${done}/${todo.length} words this run. Failed batches: ${failedBatches}.`)
  console.log(cost.summary())
  console.log(`Checkpoint: ${config.checkpointPath}`)
  if (failedBatches > 0) {
    console.log('Re-run the same command to retry — completed words are skipped automatically.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
