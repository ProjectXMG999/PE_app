import type { WordTask } from './types.js'

// Groups words into request batches per pack (not arbitrary fixed-size
// slices across pack boundaries). This matters for the style guide: rules
// like "don't duplicate a sentence's function within the same pack" and
// "vary structure across words" only make sense if the model sees a pack's
// words together in one request. collectWordTasks() already yields words
// pack-by-pack in order, so a pack's words are always contiguous here — we
// only need to cut a new batch when the pack changes or the running batch
// hits maxBatchSize (only relevant for the handful of packs bigger than
// that cap; most packs — median 15, avg ~13 words — fit in a single batch).
export function chunkByPack(tasks: WordTask[], maxBatchSize: number): WordTask[][] {
  const batches: WordTask[][] = []
  let current: WordTask[] = []
  let currentPackId: string | null = null

  for (const task of tasks) {
    if (task.packId !== currentPackId || current.length >= maxBatchSize) {
      if (current.length > 0) batches.push(current)
      current = []
      currentPackId = task.packId
    }
    current.push(task)
  }
  if (current.length > 0) batches.push(current)
  return batches
}
