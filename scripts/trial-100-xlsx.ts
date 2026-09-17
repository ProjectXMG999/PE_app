// One-off trial: run the current promptTrial.ts (5-slot, PL-first) against a
// larger, pack-batched sample (word ids read from a JSON file, grouped by
// pack the same way production does) and write the result as an Excel file
// for review — same shape as the production candidates-master exports
// (wordId/english/polish + 5 candidate PL/EN pairs) but entirely separate
// from the production checkpoint/export pipeline. Nothing here touches
// checkpoint.jsonl or database/database/candidates-master-v4.xlsx.
//
// Usage: npm run gen-sentences:trial-100

import { z } from 'zod'
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { ROOT } from './sentences/lib/config.js'
import { SYSTEM_PROMPT_TRIAL, buildUserPromptTrial } from './sentences/lib/promptTrial.js'
import { chunkByPack } from './sentences/lib/batching.js'
import { createLimiter } from './sentences/lib/limiter.js'
import { RepetitionTracker } from './sentences/lib/repetitionTracker.js'
import type { WordTask } from './sentences/lib/types.js'

const SentenceCandidateSchema = z.object({
  sentencePl: z.string().min(1),
  sentenceEn: z.string().min(1),
})
const SentenceItemSchema = z.object({
  id: z.string(),
  candidate1: SentenceCandidateSchema,
  candidate2: SentenceCandidateSchema,
  candidate3: SentenceCandidateSchema,
  candidate4: SentenceCandidateSchema,
  candidate5: SentenceCandidateSchema,
})
const SentenceBatchSchema = z.object({ sentences: z.array(SentenceItemSchema) })
type ParsedItem = z.infer<typeof SentenceItemSchema>

const WORDS_PATH = path.join(ROOT, 'scripts/trial-100-words.json')
const OUT_XLSX_PATH = path.join(ROOT, 'sentence-output/trial-100-sample.xlsx')
const SHEET_NAME = 'Kandydaci (test 100)'

async function main() {
  if (!fs.existsSync(WORDS_PATH)) {
    console.error(`Missing ${WORDS_PATH} — expected a JSON array of WordTask objects.`)
    process.exit(1)
  }
  const words: WordTask[] = JSON.parse(fs.readFileSync(WORDS_PATH, 'utf-8'))
  console.log(`Trial-100: ${words.length} words, model=gpt-5.6-terra, promptTrial.ts (5 slots, PL-first)`)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('OPENAI_API_KEY env var not set (add it to .env)')
    process.exit(1)
  }
  const client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 3 })
  const limiter = createLimiter(6)
  const repetitionTracker = new RepetitionTracker()

  const batches = chunkByPack(words, 20)
  console.log(`Batched into ${batches.length} pack-sized requests`)

  const resultsById = new Map<string, ParsedItem>()
  let promptTokens = 0
  let completionTokens = 0
  let done = 0

  await Promise.all(
    batches.map((batch) =>
      limiter(async () => {
        try {
          const completion = await client.beta.chat.completions.parse({
            model: 'gpt-5.6-terra',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT_TRIAL },
              { role: 'user', content: buildUserPromptTrial(batch) },
            ],
            response_format: zodResponseFormat(SentenceBatchSchema, 'sentence_batch'),
          })
          const parsed = completion.choices[0]?.message.parsed
          if (!parsed) throw new Error('No parsed content returned')

          promptTokens += completion.usage?.prompt_tokens ?? 0
          completionTokens += completion.usage?.completion_tokens ?? 0

          for (const s of parsed.sentences) {
            resultsById.set(s.id, s)
          }
          for (const w of batch) {
            const s = resultsById.get(w.id)
            if (s) {
              repetitionTracker.addRecord({
                candidate1En: s.candidate1.sentenceEn,
                candidate2En: s.candidate2.sentenceEn,
                candidate3En: s.candidate3.sentenceEn,
                candidate4En: s.candidate4.sentenceEn,
                candidate5En: s.candidate5.sentenceEn,
                english: w.english,
              })
            }
          }
          done += batch.length
          const cost = (promptTokens / 1e6) * 2 + (completionTokens / 1e6) * 12
          console.log(`[${done}/${words.length}] est. cost so far $${cost.toFixed(4)}`)
        } catch (err) {
          console.error(`Batch failed (${batch.map((w) => w.id).join(', ')}):`, err instanceof Error ? err.message : err)
        }
      })
    )
  )

  const finalCost = (promptTokens / 1e6) * 2 + (completionTokens / 1e6) * 12
  console.log(
    `\nDone. Generated ${resultsById.size}/${words.length}. ${promptTokens} in / ${completionTokens} out tokens — est. cost $${finalCost.toFixed(4)}`
  )

  const header = [
    'wordId',
    'packName',
    'category',
    'level',
    'Słowo ENG',
    'Tłumaczenie PL',
    'Zdanie PL 1',
    'Zdanie ENG 1',
    'Zdanie PL 2',
    'Zdanie ENG 2',
    'Zdanie PL 3',
    'Zdanie ENG 3',
    'Zdanie PL 4',
    'Zdanie ENG 4',
    'Zdanie PL 5',
    'Zdanie ENG 5',
  ]
  const rows: (string | number)[][] = [header]
  for (const w of words) {
    const s = resultsById.get(w.id)
    rows.push([
      w.id,
      w.packName,
      w.category,
      w.level,
      w.english,
      w.polish,
      s?.candidate1.sentencePl ?? '',
      s?.candidate1.sentenceEn ?? '',
      s?.candidate2.sentencePl ?? '',
      s?.candidate2.sentenceEn ?? '',
      s?.candidate3.sentencePl ?? '',
      s?.candidate3.sentenceEn ?? '',
      s?.candidate4.sentencePl ?? '',
      s?.candidate4.sentenceEn ?? '',
      s?.candidate5.sentencePl ?? '',
      s?.candidate5.sentenceEn ?? '',
    ])
  }

  fs.mkdirSync(path.dirname(OUT_XLSX_PATH), { recursive: true })
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet['!cols'] = header.map((h, i) => {
    const maxLen = rows.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), h.length)
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) }
  })
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }) }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME)
  XLSX.writeFile(workbook, OUT_XLSX_PATH)
  console.log(`✓ Wrote ${words.length} rows to ${OUT_XLSX_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
