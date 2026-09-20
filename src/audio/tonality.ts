/**
 * One musical key per level.
 *
 * The four levels are the app's spine — the route, the pack colours, the
 * station names all key off them — so the sound follows the same axis: moving
 * up a level is audible, not only visible. Shared here rather than owned by one
 * caller so the drone under Słuchaj (audio/studyPad.ts) and the session chimes
 * (services/sfx.ts) can never drift into different keys.
 *
 * Roots are deliberately low — these are drone fundamentals, not melody notes.
 */

export interface LevelKey {
  /** Fundamental, in Hz. */
  rootHz: number
  /** Scale degrees as semitone offsets from the root, one octave. */
  scale: number[]
  /** For the record, and for anyone reading a spectrogram. */
  name: string
}

/** Major: the plain, unambiguous one, for the plain first level. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
/** Mixolydian: major with a flat seventh — brighter than minor, less settled. */
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10]
/** Dorian: minor with a raised sixth — serious without being sad. */
const DORIAN = [0, 2, 3, 5, 7, 9, 10]

export const LEVEL_KEY: Record<number, LevelKey> = {
  1: { rootHz: 65.41, scale: MAJOR, name: 'C-dur' },
  2: { rootHz: 98.0, scale: MAJOR, name: 'G-dur' },
  3: { rootHz: 110.0, scale: MIXOLYDIAN, name: 'A-miksolidyjska' },
  4: { rootHz: 73.42, scale: DORIAN, name: 'd-dorycka' },
}

export function keyForLevel(level: number | null | undefined): LevelKey {
  return LEVEL_KEY[level ?? 1] ?? LEVEL_KEY[1]
}

/** Frequency of a scale degree, wrapping into higher octaves past the seventh. */
export function degreeHz(key: LevelKey, degree: number, octave = 0): number {
  const n = key.scale.length
  const wrapped = ((degree % n) + n) % n
  const octaves = octave + Math.floor(degree / n)
  return key.rootHz * Math.pow(2, key.scale[wrapped] / 12 + octaves)
}
