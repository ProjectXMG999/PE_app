import { getAllPackageProgress, getAllSessions, savePackageProgress } from './db'
import { PackageProgress, Session } from '../types/progress'
import { ListenAxis } from './listenAxis'

/**
 * Brings the listen axis back in line with what actually happened.
 *
 * Until the axis was split out (see services/listenAxis.ts), `currentIndex`
 * was written by a Trenuj run, by "Znam wszystko", by a level declaration and
 * by the boot-time mastery repair — each stamping the pack's full word count.
 * So accounts carry packs claiming a full listen that was never played, and
 * partial positions left by fiszki taps, where the number was an index into
 * the still-unknown SUBSET of the pack and meant nothing at all.
 *
 * The evidence we repair against is the session log. An autoplay session is
 * only ever written after the last card of the pack (in Słuchaj the deck is
 * always the whole pack, never a subset), so its existence is proof of a full
 * play-through rather than a hint — and FlashcardPage now writes the session
 * BEFORE the package row, so "full position, no session" is a state the app
 * cannot produce any more.
 *
 * Deliberately a standing repair rather than a one-time migration with a
 * `localStorage` flag: the flag would be per-device while the data is shared,
 * so an un-migrated phone would resurrect the old values through the
 * cross-device merge and nothing would ever converge. It is idempotent, and
 * once Stage 1 has landed there is nothing left for it to find.
 */

export interface ListenRepairInput {
  progress: Pick<PackageProgress, 'currentIndex' | 'listenedAt'>
  /** Timestamp of the newest autoplay session for this pack, or null if the
   *  pack was never played through. */
  listenProof: string | null
}

/** The corrected axis, or null when the row is already truthful — the caller
 *  writes (and re-syncs) only what actually changed. */
export function repairedListenAxis({ progress, listenProof }: ListenRepairInput): ListenAxis | null {
  const listenedAt = progress.listenedAt ?? null

  if (listenProof == null) {
    // No session ever — the pointer and the claim are both fabrications.
    // Clearing a partial position costs at most the "Przerwana sesja" card of
    // an abandoned real listen, which is one tap to rebuild; leaving it costs
    // a permanent invitation to resume a pack nobody started.
    if (listenedAt == null && progress.currentIndex === 0) return null
    return { currentIndex: 0, listenedAt: null }
  }

  // Played through, but from before the field existed — backfill the date so
  // the badge on Podgląd paczki has something to show.
  if (listenedAt != null) return null
  return { currentIndex: progress.currentIndex, listenedAt: listenProof }
}

/** Newest autoplay session per pack. Day keys are normalised to midday so a
 *  backfilled date sorts and formats like any other stamp. */
export function listenProofByPack(sessions: Session[]): Map<string, string> {
  const proof = new Map<string, string>()
  for (const s of sessions) {
    if (s.mode !== 'autoplay') continue
    const stamp = s.startedAt ?? `${s.date}T12:00:00.000Z`
    const best = proof.get(s.packageId)
    if (best == null || stamp > best) proof.set(s.packageId, stamp)
  }
  return proof
}

/** Runs the repair over every pack row. Returns how many rows it corrected. */
export async function repairListenAxis(): Promise<number> {
  const [packages, sessions] = await Promise.all([getAllPackageProgress(), getAllSessions()])
  const proof = listenProofByPack(sessions)

  let fixed = 0
  for (const pp of packages) {
    const repaired = repairedListenAxis({
      progress: pp,
      listenProof: proof.get(pp.packageId) ?? null,
    })
    if (!repaired) continue
    await savePackageProgress({ ...pp, ...repaired })
    fixed++
  }

  if (fixed > 0) console.info(`[listen] repaired the listen axis on ${fixed} pack(s)`)
  return fixed
}
