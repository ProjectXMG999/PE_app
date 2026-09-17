// One-off trial: run the revised prompt (lib/promptTrial.ts — addresses
// "NPC vibe" flatness, Polish translation naturalness, and adds a 4th
// "movie voice" slot) against a small, diverse hand-picked word sample, and
// print all 4 candidates per word for manual review. Does NOT touch
// checkpoint.jsonl or any production export — purely a side-by-side
// sample so the prompt can be judged before committing to a full regen.
//
// Usage: npm run gen-sentences:trial

import { z } from 'zod'
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import fs from 'fs'
import path from 'path'
import { ROOT } from './sentences/lib/config.js'
import { SYSTEM_PROMPT_TRIAL, buildUserPromptTrial } from './sentences/lib/promptTrial.js'
import type { WordTask } from './sentences/lib/types.js'

// Field order matters mechanically, not just cosmetically: OpenAI structured
// outputs emit JSON fields in schema declaration order, so with sentencePl
// declared first, the model actually generates the Polish string before the
// English one — making the prompt's "write Polish first" instruction
// something the decoding process can actually honor, instead of prose the
// model has no way to act on (previously sentenceEn was declared first,
// silently forcing English-first generation regardless of what the prompt
// said).
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

async function main() {
  const wordsPath = path.join(ROOT, 'scripts/trial-words.json')
  if (!fs.existsSync(wordsPath)) {
    console.error(`Missing ${wordsPath} — expected a JSON array of WordTask objects.`)
    process.exit(1)
  }
  const words: WordTask[] = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'))
  console.log(`Trial: ${words.length} words, model=gpt-5.6-terra, revised prompt (4 slots incl. movie voice)`)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('OPENAI_API_KEY env var not set (add it to .env)')
    process.exit(1)
  }
  const client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 3 })

  // Same word set fits in one pack-sized batch for this trial (<=20 words).
  const completion = await client.beta.chat.completions.parse({
    model: 'gpt-5.6-terra',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_TRIAL },
      { role: 'user', content: buildUserPromptTrial(words) },
    ],
    response_format: zodResponseFormat(SentenceBatchSchema, 'sentence_batch'),
  })

  const parsed = completion.choices[0]?.message.parsed
  if (!parsed) {
    console.error('No parsed content returned.')
    process.exit(1)
  }

  const usage = completion.usage
  console.log(`Tokens: ${usage?.prompt_tokens ?? '?'} in / ${usage?.completion_tokens ?? '?'} out\n`)

  const byId = new Map(parsed.sentences.map((s) => [s.id, s]))
  const outLines: string[] = []
  for (const w of words) {
    const s = byId.get(w.id)
    if (!s) {
      console.log(`[${w.english}] MISSING`)
      continue
    }
    const block = [
      `[${w.english} / ${w.polish}]`,
      `  1 (współczesność):      ${s.candidate1.sentencePl}`,
      `                          ${s.candidate1.sentenceEn}`,
      `  2 (mikroemocje-ciepło): ${s.candidate2.sentencePl}`,
      `                          ${s.candidate2.sentenceEn}`,
      `  3 (spoken):             ${s.candidate3.sentencePl}`,
      `                          ${s.candidate3.sentenceEn}`,
      `  4 (mikroemocje-humor):  ${s.candidate4.sentencePl}`,
      `                          ${s.candidate4.sentenceEn}`,
      `  5 (realistyczna codz.): ${s.candidate5.sentencePl}`,
      `                          ${s.candidate5.sentenceEn}`,
      '',
    ].join('\n')
    console.log(block)
    outLines.push(block)
  }

  const outPath = path.join(ROOT, 'sentence-output/trial-v9-diversity-fix.txt')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf-8')
  console.log(`Saved to ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
