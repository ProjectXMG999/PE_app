import { PackageProgress, StudyMode } from '../types/progress'

/**
 * The one place allowed to move the listen axis.
 *
 * `currentIndex` is documented as the Słuchaj playback pointer and is the sole
 * source of every "odsłuchane" figure in the app — but it used to be written
 * by the shared card-advance path of BOTH study modes, by the end of a Trenuj
 * run, by "Znam wszystko" and by a level declaration, each of them stamping
 * the full word count. So knowledge reported itself as listening: declare a
 * level mastered and the whole level read "✓ Odsłuchana" without a second of
 * audio.
 *
 * Two reasons fiszki must not touch it, not just the cosmetic one:
 *  - in fiszki `index` walks `studyWords`, the still-unknown SUBSET of the
 *    pack, so the number means nothing as a position in the pack; and
 *  - finishing that subset wrote the pack's FULL word count, which is what
 *    made trained packs count as heard.
 *
 * Pure and dependency-free so it can be tested the way the rest of this
 * service layer is (see applyLevelMasteryToWord, applyKnown) — the repo mocks
 * neither IndexedDB nor Supabase.
 */

/** Just the two fields that make up the axis — the caller merges them into the
 *  row it writes, leaving completedAt/masteredAt to their own logic. */
export interface ListenAxis {
  currentIndex: number
  listenedAt: string | null
}

export interface ListenStep {
  /** Which mode produced the advance. Only 'autoplay' may move the axis. */
  mode: StudyMode
  /** Position reached, as an index into the pack's full word list. */
  index: number
  /** The run reached the last card. In autoplay this is the genuine
   *  play-through signal — it also covers skipping the final card, which does
   *  reach the end of the pack. */
  reachedEnd: boolean
  wordCount: number
}

export function applyListenProgress(
  existing: Pick<PackageProgress, 'currentIndex' | 'listenedAt'> | undefined,
  step: ListenStep,
  now: Date = new Date(),
): ListenAxis {
  const current = existing?.currentIndex ?? 0
  const listenedAt = existing?.listenedAt ?? null

  // Every other mode passes straight through — untouched, not reset.
  if (step.mode !== 'autoplay') return { currentIndex: current, listenedAt }

  // Never let the pointer regress: a re-listen that stops early keeps the
  // furthest spot already reached.
  const reached = step.reachedEnd ? step.wordCount : step.index
  return {
    currentIndex: Math.min(step.wordCount, Math.max(reached, current)),
    // Dated to the FIRST full play-through; re-listening doesn't restamp it.
    listenedAt: step.reachedEnd ? (listenedAt ?? now.toISOString()) : listenedAt,
  }
}
