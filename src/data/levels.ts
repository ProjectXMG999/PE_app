export const LEVEL_COLORS: Record<number, string> = {
  1: 'var(--accent-yellow)',
  2: 'var(--accent-orange)',
  3: 'var(--accent-green)',
  4: 'var(--accent-blue)',
}

export interface LevelMeta {
  level: number
  name: string
  /** The word count that defines this level — matches LEVEL_TIERS below. */
  threshold: number
  /** One line for the route map: what this level lets you actually do. */
  promise: string
  /** The full pitch, used on the Pakiety filter tabs. */
  description: string
}

/**
 * The four named levels. Lives here rather than next to the filter tabs because
 * the route map on Postęp and the level badges both need it — a stats page
 * importing copy out of a Home component was the wrong direction of dependency.
 */
export const LEVEL_META: LevelMeta[] = [
  {
    level: 1,
    name: 'Survival English',
    threshold: 1000,
    promise: 'Dogadasz się w podróży.',
    description: 'Znasz około 1000 najważniejszych słów. To jeszcze nie jest pełna swoboda, ale to już jest moment, w którym przestajesz być bezbronny. Zamówisz jedzenie, zapytasz o drogę, ogarniesz hotel, lotnisko, podstawową rozmowę i powiesz, czego potrzebujesz. To jest Twój językowy ekwipunek przetrwania.',
  },
  {
    level: 2,
    name: 'Everyday English',
    threshold: 3000,
    promise: 'Powiesz, co myślisz, na spotkaniu.',
    description: 'Znasz około 3000 słów. To jest moment, w którym zaczynasz naprawdę funkcjonować po angielsku. Porozmawiasz o pracy, podróżach, planach, rodzinie, problemach, emocjach i codziennych sprawach. Jeszcze czasem szukasz słów, ale już nie jesteś turystą językowym. Jesteś człowiekiem, który potrafi się dogadać.',
  },
  {
    level: 3,
    name: 'Freedom English',
    threshold: 6000,
    promise: 'Zażartujesz i opowiesz historię.',
    description: 'Znasz około 6000 słów. To jest poziom wolności. Nie musisz już ciągle upraszczać siebie. Możesz wyrazić opinię, opowiedzieć historię, zażartować, doprecyzować myśl, wytłumaczyć problem i być bardziej sobą po angielsku. Tu angielski przestaje być przeszkodą, a zaczyna być narzędziem.',
  },
  {
    level: 4,
    name: 'World-Class English',
    threshold: 10000,
    promise: 'Brzmisz jak obywatel świata.',
    description: 'Znasz około 10 000 słów. To jest poziom, na którym nie tylko się komunikujesz. Ty brzmisz dobrze. Mówisz precyzyjnie, lekko, ciekawie i z klasą. Możesz prowadzić głębsze rozmowy, budować relacje, robić biznes, występować, pisać, uczyć się z anglojęzycznego świata i naprawdę czuć się obywatelem świata. To jest angielski, przy którym ludzie pytają: „gdzie Ty się tak nauczyłeś mówić?"',
  },
]

/**
 * The station defined by a word threshold.
 *
 * Necessary because two different numbering schemes meet here: LEVEL_META
 * numbers the *stations* (level 1 = Survival at 1 000), while LEVEL_TIERS below
 * numbers the *tier you become* on crossing one (level 2 at 1 000). Looking a
 * station up by tier number is therefore off by one — always match on the
 * threshold, which both schemes agree on.
 */
export function stationForThreshold(threshold: number): LevelMeta | undefined {
  return LEVEL_META.find(l => l.threshold === threshold)
}

/** The full route length — the last milestone on the map. */
export const ROUTE_TOTAL = 10000

/** Every 100 words is a small win, and the route marks each one. */
export const MARKER_STEP = 100

// Cumulative known-word thresholds that define overall vocabulary knowledge
// tiers — independent of which difficulty tier a pack is tagged with.
// Everyone starts at Level 1, so each entry is how many words it takes to
// REACH that tier (there's no threshold for Level 1 itself). MASTER is the
// final tier beyond Level 4.
const LEVEL_TIERS: { level: number | 'MASTER'; threshold: number }[] = [
  { level: 2, threshold: 1000 },
  { level: 3, threshold: 3000 },
  { level: 4, threshold: 6000 },
  { level: 'MASTER', threshold: 10000 },
]

export interface NextLevelInfo {
  level: number | 'MASTER'
  wordsToNext: number
  pct: number
}

export interface MarkerInfo {
  nextMarker: number
  toMarker: number
  markerReached: number
}

/** The nearest 100-word marker ahead — the smallest "small win" on the route. */
export function nextMarkerInfo(knownWords: number): MarkerInfo {
  const nextMarker = (Math.floor(knownWords / MARKER_STEP) + 1) * MARKER_STEP
  return {
    nextMarker,
    toMarker: nextMarker - knownWords,
    markerReached: knownWords % MARKER_STEP,
  }
}

/**
 * Knowledge tier derived from the total count of mastered words across the
 * whole app (not per pack-level). Returns the next tier to reach, how many
 * more mastered words that takes, and progress (%) through the current band.
 * Returns null once MASTER (the final tier) has been reached.
 */
export function nextLevelFromTotalKnown(knownTotal: number): NextLevelInfo | null {
  let prevThreshold = 0
  for (const tier of LEVEL_TIERS) {
    if (knownTotal < tier.threshold) {
      const span = tier.threshold - prevThreshold
      const progressed = knownTotal - prevThreshold
      return {
        level: tier.level,
        wordsToNext: tier.threshold - knownTotal,
        pct: span > 0 ? Math.min(100, Math.max(0, Math.round((progressed / span) * 100))) : 100,
      }
    }
    prevThreshold = tier.threshold
  }
  return null
}
