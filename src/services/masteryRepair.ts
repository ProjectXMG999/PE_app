import { getAllPackageProgress, getAllWordProgress, savePackageProgress } from './db'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'

const wordCountById = new Map((packagesIndex as PackMeta[]).map(p => [p.id, p.wordCount]))

/**
 * Heals packages left with `masteredAt` set while their words are NOT actually
 * all `known` — the state behind "★ Opanowana · 0 / 10 opanowanych".
 *
 * `masteredAt` is sticky by design (a mastered word never demotes, so nothing
 * un-masters a pack on its own), and a few accounts carry packs where it was
 * set without the matching word progress — most plausibly an interrupted
 * cross-device merge (progressSync's betterPackageProgress keeps whichever side
 * has masteredAt) or an early local seed whose word rows were later cleared.
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

  if (fixed > 0) console.info(`[mastery] cleared ${fixed} stale masteredAt flag(s)`)
  return fixed
}
