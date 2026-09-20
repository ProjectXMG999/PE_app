import {
  getAllPackageProgress,
  getAllWordProgress,
  getPackageProgress,
  getPackageWordProgress,
  savePackageProgress,
} from './db'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'

const wordCountById = new Map((packagesIndex as PackMeta[]).map(p => [p.id, p.wordCount]))

/**
 * Immediate, targeted version of `repairMasteryFlags`'s "promote" pass: after a
 * cross-pack session (Powtórka / Inteligentny) whose last cards may have
 * finished off a pack, stamp `masteredAt` on any of `packageIds` that are now
 * fully known but weren't flagged. Boot-time `repairMasteryFlags` would catch it
 * eventually; this makes the pack read as "★ Opanowana" without a reload.
 */
export async function recomputeMasteryFor(packageIds: string[]): Promise<void> {
  await Promise.all(
    [...new Set(packageIds)].map(async id => {
      const total = wordCountById.get(id)
      if (total == null || total === 0) return
      const pp = await getPackageProgress(id)
      if (pp?.masteredAt != null) return
      const words = await getPackageWordProgress(id)
      const known = words.filter(w => w.status === 'known').length
      if (known < total) return
      const nowIso = new Date().toISOString()
      await savePackageProgress({
        packageId: id,
        startedAt: pp?.startedAt ?? nowIso,
        completedAt: pp?.completedAt ?? nowIso,
        masteredAt: pp?.completedAt ?? nowIso,
        // Knowing every word says nothing about having heard them — the listen
        // axis passes through. See services/listenAxis.ts.
        listenedAt: pp?.listenedAt ?? null,
        currentIndex: pp?.currentIndex ?? 0,
      })
    })
  )
}

/**
 * Reconciles a pack's `masteredAt` flag with whether its words are actually all
 * `known`, in both directions:
 *  - clears `masteredAt` where the known count is BELOW the word count
 *    ("★ Opanowana · 0 / 10 opanowanych"), and
 *  - sets `masteredAt` where every word is known but the flag was never written
 *    ("✓ Przerobiona · 10 / 10", with no way to finish the pack).
 *
 * `masteredAt` is sticky by design (a mastered word never demotes, so nothing
 * un-masters a pack on its own), and a few accounts carry packs where it was
 * set without the matching word progress — most plausibly an interrupted
 * cross-device merge (progressSync's betterPackageProgress keeps a masteredAt
 * from either side) or an early local seed whose word rows were later cleared.
 *
 * Conservative: only clears the flag where the known count is BELOW the pack's
 * word count. A genuinely mastered pack (known === wordCount) is never touched,
 * and the words themselves are left alone — only the pack-level flag changes.
 * Idempotent, so it's fine to run on every boot; it writes (and re-syncs) only
 * on the first run that finds damage.
 */
export async function repairMasteryFlags(): Promise<number> {
  const [packages, words] = await Promise.all([
    getAllPackageProgress(),
    getAllWordProgress(),
  ])

  const knownByPack = new Map<string, number>()
  for (const w of words) {
    if (w.status === 'known') {
      knownByPack.set(w.packageId, (knownByPack.get(w.packageId) ?? 0) + 1)
    }
  }

  let fixed = 0
  for (const pp of packages) {
    if (pp.masteredAt == null) continue
    const total = wordCountById.get(pp.packageId)
    if (total == null) continue // pack not in the index — leave it alone
    if ((knownByPack.get(pp.packageId) ?? 0) >= total) continue // legitimately mastered

    await savePackageProgress({ ...pp, masteredAt: null })
    fixed++
  }

  // The mirror case: every word is 'known' but masteredAt was never set, so the
  // pack sits on "✓ Przerobiona · 10 / 10" with the "Znam wszystko" button
  // hidden (it only renders while knownCount < wordCount) — no way to finish it
  // off. Happens when a pack's last words graduate through /powtorka (cross-pack,
  // never touches per-pack mastery) rather than a WordFlash/ActiveSentence run.
  // Only touches packs already engaged with (a PackageProgress row exists);
  // dates the mastery to the last full run through the pack if there was one.
  let promoted = 0
  for (const pp of packages) {
    if (pp.masteredAt != null) continue
    const total = wordCountById.get(pp.packageId)
    if (total == null || total === 0) continue
    if ((knownByPack.get(pp.packageId) ?? 0) < total) continue

    // `...pp` carries the listen axis through untouched — this pass used to
    // raise currentIndex to the word count, so every fully-known pack reported
    // itself as fully listened on each boot. See services/listenAxis.ts.
    await savePackageProgress({
      ...pp,
      masteredAt: pp.completedAt ?? new Date().toISOString(),
    })
    promoted++
  }

  if (fixed > 0) console.info(`[mastery] cleared ${fixed} stale masteredAt flag(s)`)
  if (promoted > 0) console.info(`[mastery] set masteredAt on ${promoted} fully-known pack(s)`)
  return fixed + promoted
}
