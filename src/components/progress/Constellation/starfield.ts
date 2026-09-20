import { RETIRE_STABILITY_DAYS } from '../../../services/reviewConfig'
import { WordProgress } from '../../../types/progress'
import { PackMeta } from '../../../types/vocabulary'

/**
 * Turns the pack catalogue plus the user's word progress into a star field:
 * one star per word on the whole 10 000-word route, positioned deterministically
 * and lit according to how well the word is remembered.
 *
 * Deliberately pure and free of any rendering concern — the renderer only ever
 * sees typed arrays, and this module is the part worth unit-testing.
 *
 * Two things make it cheap enough to run on every open:
 *  - Position comes from the word's *index*, not its content, so no pack JSON is
 *    ever fetched. `packages-index.json` (834 rows of {id, level, wordCount}) is
 *    already imported by StatsPage, and word ids are `<packId>-<3-digit ordinal>`,
 *    which is enough to place all ~11 000 stars.
 *  - Only words the user has actually touched appear in `wordProgress`; every
 *    other star is dust, and dust needs no per-word data at all.
 */

/** Star states, mirrored by the shader's `aState` attribute. */
export const STATE_DUST = 0
export const STATE_LEARNING = 1
export const STATE_KNOWN = 2
export const STATE_RETIRED = 3

/** Ignite value marking a star that is always on (dust never animates in). */
export const IGNITE_ALWAYS = -1

export interface Starfield {
  /** Total stars — every word on the route, studied or not. */
  count: number
  /** x, y interleaved, in the unit disc (-1..1). */
  position: Float32Array
  /** Pack difficulty tier 1..4 — the shader maps it to a level colour. */
  level: Float32Array
  /** 0..1 — how brightly the star burns. Derived from FSRS stability. */
  brightness: Float32Array
  /** One of the STATE_* constants. */
  state: Float32Array
  /** Ignition order 0..1 for the intro sweep, or IGNITE_ALWAYS for dust. */
  ignite: Float32Array
  /** Stable per-star randomness, for twinkle phase. */
  seed: Float32Array
  /** 1 for a word that has lapsed at least once — it flickers. 0 otherwise. */
  flicker: Float32Array
  /** Index into the `packs` array the star belongs to — for hit testing. */
  packOf: Uint16Array
  /** 1-based ordinal of the word inside its pack — for hit testing. */
  ordinalOf: Uint16Array
  /** Index into the `wordProgress` array, or -1 when the word is untouched. */
  progressOf: Int32Array
  /** How many stars are lit (anything that isn't dust). */
  litCount: number
}

/** Golden angle — gives the evenly packed sunflower spiral (Vogel's model). */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** Deterministic 0..1 hash, so the same word jitters and twinkles identically
 *  on every open and on every device. */
function hash01(i: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * How brightly a word burns, 0..1.
 *
 * Log-scaled on FSRS stability because the interesting range is the low end:
 * the difference between "remembered for 2 days" and "remembered for 3 weeks"
 * matters far more to the learner than the difference between a year and two.
 *
 * Words with no `stability` are the pre-FSRS ones (see WordProgress.stability) —
 * they get the middle of the band rather than being shown as dim, since their
 * dimness would be an artefact of a migration, not of forgetting.
 */
export function brightnessFor(wp: WordProgress): number {
  if (wp.retiredAt != null) return 1
  if (wp.status === 'learning') return 0.3
  if (wp.status !== 'known') return 0.15
  if (wp.stability == null) return 0.6
  const t = Math.log1p(Math.max(0, wp.stability)) / Math.log1p(RETIRE_STABILITY_DAYS)
  return 0.45 + 0.55 * Math.min(1, t)
}

function stateFor(wp: WordProgress): number {
  if (wp.retiredAt != null) return STATE_RETIRED
  if (wp.status === 'known') return STATE_KNOWN
  if (wp.status === 'learning') return STATE_LEARNING
  return STATE_DUST
}

/**
 * Splits `t1-p001-007` into its pack id and 1-based ordinal. Returns null for
 * anything that doesn't match, so a stray id can never shift every star after
 * it by one.
 */
export function parseWordId(wordId: string): { packId: string; ordinal: number } | null {
  const cut = wordId.lastIndexOf('-')
  if (cut <= 0) return null
  const ordinal = Number(wordId.slice(cut + 1))
  if (!Number.isInteger(ordinal) || ordinal < 1) return null
  return { packId: wordId.slice(0, cut), ordinal }
}

/** Rebuilds the word id a star stands for — the inverse of parseWordId. */
export function wordIdAt(field: Starfield, packs: PackMeta[], star: number): string | null {
  const pack = packs[field.packOf[star]]
  if (!pack) return null
  return `${pack.id}-${String(field.ordinalOf[star]).padStart(3, '0')}`
}

export function buildStarfield(packs: PackMeta[], wordProgress: WordProgress[]): Starfield {
  let count = 0
  for (const p of packs) count += p.wordCount

  const position = new Float32Array(count * 2)
  const level = new Float32Array(count)
  const brightness = new Float32Array(count)
  const state = new Float32Array(count)
  const ignite = new Float32Array(count)
  const seed = new Float32Array(count)
  const flicker = new Float32Array(count)
  const packOf = new Uint16Array(count)
  const ordinalOf = new Uint16Array(count)
  const progressOf = new Int32Array(count).fill(-1)

  // wordId → its position in the wordProgress array. One pass, then every star
  // is a map lookup rather than a scan.
  const byWordId = new Map<string, number>()
  for (let i = 0; i < wordProgress.length; i++) byWordId.set(wordProgress[i].wordId, i)

  // Global index → star. Packs are ordered by frequency in packages-index.json,
  // so the index *is* the frequency rank: the sunflower spiral then puts the
  // commonest words in the bright core and the rarest on the outer rim, with
  // the level bands falling out as concentric rings for free.
  let star = 0
  for (let p = 0; p < packs.length; p++) {
    const pack = packs[p]
    for (let ord = 1; ord <= pack.wordCount; ord++, star++) {
      const r = Math.sqrt((star + 0.5) / count)
      const theta = star * GOLDEN_ANGLE
      // A touch of deterministic jitter — a perfect phyllotaxis reads as a
      // machine-drawn pattern, and this is meant to read as a sky.
      const jx = (hash01(star) - 0.5) * 0.006
      const jy = (hash01(star + 0x5f3759df) - 0.5) * 0.006
      position[star * 2] = r * Math.cos(theta) + jx
      position[star * 2 + 1] = r * Math.sin(theta) + jy

      level[star] = pack.level
      seed[star] = hash01(star * 2 + 1)
      packOf[star] = p
      ordinalOf[star] = ord
      ignite[star] = IGNITE_ALWAYS
      state[star] = STATE_DUST

      const wpIndex = byWordId.get(`${pack.id}-${String(ord).padStart(3, '0')}`)
      if (wpIndex == null) continue
      const wp = wordProgress[wpIndex]
      const st = stateFor(wp)
      if (st === STATE_DUST) continue
      progressOf[star] = wpIndex
      state[star] = st
      brightness[star] = brightnessFor(wp)
      // A word you once answered "Nie znam" after mastering it never quite
      // settles again — it flickers, which is the honest picture.
      flicker[star] = (wp.lapseCount ?? 0) > 0 ? 1 : 0
    }
  }

  // The intro sweep lights the stars in the order they were learned, so the
  // animation replays the user's own history rather than an arbitrary order.
  // Words with no lastSeen sort first — they can only predate the field.
  const lit: number[] = []
  for (let i = 0; i < count; i++) if (state[i] !== STATE_DUST) lit.push(i)
  lit.sort((a, b) => {
    const wa = wordProgress[progressOf[a]]?.lastSeen ?? ''
    const wb = wordProgress[progressOf[b]]?.lastSeen ?? ''
    return wa < wb ? -1 : wa > wb ? 1 : a - b
  })
  const span = Math.max(1, lit.length - 1)
  for (let k = 0; k < lit.length; k++) ignite[lit[k]] = k / span

  return {
    count,
    position,
    level,
    brightness,
    state,
    ignite,
    seed,
    flicker,
    packOf,
    ordinalOf,
    progressOf,
    litCount: lit.length,
  }
}

/**
 * Nearest lit star to a point in unit-disc space, or -1 if nothing is close
 * enough. Dust is never a hit target: tapping a word you have never seen has
 * nothing to say.
 */
export function hitTest(field: Starfield, x: number, y: number, radius: number): number {
  let best = -1
  let bestDist = radius * radius
  for (let i = 0; i < field.count; i++) {
    if (field.state[i] === STATE_DUST) continue
    const dx = field.position[i * 2] - x
    const dy = field.position[i * 2 + 1] - y
    const d = dx * dx + dy * dy
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}
