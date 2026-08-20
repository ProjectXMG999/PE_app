import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { SentenceBatchSchema, type SentenceBatch } from './schema.js'
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js'
import type { WordTask } from './types.js'

export interface GenerateBatchResult {
  batch: SentenceBatch
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined
}

// The OpenAI SDK already retries 429/5xx/network errors internally
// (maxRetries below). This additional loop only covers the failure mode the
// SDK can't see: a structurally valid response whose ids don't match what
// was requested (missing word, hallucinated id, wrong count).
const MAX_VALIDATION_RETRIES = 2

export function createClient(apiKey: string, timeoutMs: number, maxRetries: number): OpenAI {
  return new OpenAI({ apiKey, timeout: timeoutMs, maxRetries })
}

export async function generateBatch(
  client: OpenAI,
  model: string,
  words: WordTask[],
  avoidWords: string[] = []
): Promise<GenerateBatchResult> {
  const requestedIds = new Set(words.map((w) => w.id))
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
    const completion = await client.beta.chat.completions.parse({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(words, avoidWords) },
      ],
      response_format: zodResponseFormat(SentenceBatchSchema, 'sentence_batch'),
    })

    const choice = completion.choices[0]
    if (choice.message.refusal) {
      lastError = new Error(`Model refused batch: ${choice.message.refusal}`)
      continue
    }

    const parsed = choice.message.parsed
    if (!parsed) {
      lastError = new Error('Model returned no parsed content')
      continue
    }

    const returnedIds = new Set(parsed.sentences.map((s) => s.id))
    const missing = [...requestedIds].filter((id) => !returnedIds.has(id))
    const unknown = [...returnedIds].filter((id) => !requestedIds.has(id))

    if (missing.length === 0 && unknown.length === 0) {
      return { batch: parsed, usage: completion.usage }
    }

    lastError = new Error(`Batch id mismatch — missing: [${missing.join(', ')}], unknown: [${unknown.join(', ')}]`)
  }

  throw lastError instanceof Error ? lastError : new Error('Batch generation failed')
}
