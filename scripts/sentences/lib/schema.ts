import { z } from 'zod'

// Exactly 5 candidates per word, modeled as fixed named fields (not a
// variable-length array) so the OpenAI strict structured-output schema
// guarantees the count at the API level instead of relying on a runtime
// length check after the fact.
//
// sentencePl is declared BEFORE sentenceEn on purpose: structured outputs
// emit fields in declaration order, so this is what makes the prompt's
// "write the Polish sentence first, then translate" actually happen token
// by token. With the English field first, the model was mechanically forced
// to commit to English before writing any Polish, and the Polish came out
// calqued.
export const SentenceCandidateSchema = z.object({
  sentencePl: z.string().min(1),
  sentenceEn: z.string().min(1),
})

export const SentenceItemSchema = z.object({
  id: z.string(),
  candidate1: SentenceCandidateSchema,
  candidate2: SentenceCandidateSchema,
  candidate3: SentenceCandidateSchema,
  candidate4: SentenceCandidateSchema,
  candidate5: SentenceCandidateSchema,
})

export const SentenceBatchSchema = z.object({
  sentences: z.array(SentenceItemSchema),
})

export type SentenceBatch = z.infer<typeof SentenceBatchSchema>
