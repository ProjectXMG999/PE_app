import { z } from 'zod'

// Exactly 3 candidates per word, modeled as 3 fixed named fields (not a
// variable-length array) so the OpenAI strict structured-output schema
// guarantees the count at the API level instead of relying on a runtime
// length check after the fact.
export const SentenceCandidateSchema = z.object({
  sentenceEn: z.string().min(1),
  sentencePl: z.string().min(1),
})

export const SentenceItemSchema = z.object({
  id: z.string(),
  candidate1: SentenceCandidateSchema,
  candidate2: SentenceCandidateSchema,
  candidate3: SentenceCandidateSchema,
})

export const SentenceBatchSchema = z.object({
  sentences: z.array(SentenceItemSchema),
})

export type SentenceBatch = z.infer<typeof SentenceBatchSchema>
