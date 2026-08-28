/**
 * Badge definitions.
 *
 * Every badge is a threshold on a metric that the app already measures, so the
 * whole set is derived on read — nothing here is stored per user beyond the date
 * it was first earned (see `achievementUnlocks` in the app store).
 *
 * Locked badges are never hidden. The route metaphor only works if you can see
 * what's ahead of you, so a badge you haven't earned shows its target rather
 * than a question mark.
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'legend'

/** Metrics an achievement can be measured against. See services/achievements.ts. */
export type AchievementMetric =
  | 'knownWords'
  | 'streak'
  | 'wordsHeard'
  | 'minutes'
  | 'goalDays'
  | 'reviews'
  | 'cleanDays'
  | 'masteredPacks'
  | 'speakingSessions'
  | 'earlySessions'
  | 'nightSessions'
  | 'weekendRun'
  | 'bestDay'
  | 'longestSession'
  | 'volumesDone'
  | 'chaptersDone'
  | 'categoriesStarted'
  | 'categoryComplete'

export interface AchievementGroup {
  id: string
  label: string
  icon: string
}

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  { id: 'route',       label: 'Trasa',        icon: '🗺️' },
  { id: 'streak',      label: 'Seria',        icon: '🔥' },
  { id: 'listening',   label: 'Słuchanie',    icon: '🎧' },
  { id: 'time',        label: 'Czas',         icon: '⏱️' },
  { id: 'goal',        label: 'Cel dnia',     icon: '🎯' },
  { id: 'review',      label: 'Powtórki',     icon: '🔁' },
  { id: 'clean',       label: 'Czysta trasa', icon: '🧊' },
  { id: 'packs',       label: 'Paczki',       icon: '📦' },
  { id: 'speaking',    label: 'Mówienie',     icon: '🗣️' },
  { id: 'rhythm',      label: 'Rytm dnia',    icon: '🌅' },
  { id: 'pace',        label: 'Tempo',        icon: '🏃' },
  { id: 'explore',     label: 'Eksploracja',  icon: '🧭' },
  { id: 'levels',      label: 'Etapy',        icon: '⭐' },
]

export interface Achievement {
  id: string
  group: string
  title: string
  desc: string
  icon: string
  tier: AchievementTier
  metric: AchievementMetric
  threshold: number
  /** Optional unit for the progress readout, e.g. "min". Defaults to none. */
  unit?: string
}

/** Assigns a tier by position within its own ladder, so every group escalates. */
function tierFor(index: number, total: number): AchievementTier {
  const p = total <= 1 ? 1 : index / (total - 1)
  if (p >= 0.99) return 'legend'
  if (p >= 0.66) return 'gold'
  if (p >= 0.33) return 'silver'
  return 'bronze'
}

/** Builds a ladder of threshold badges sharing one metric, icon and phrasing. */
function ladder(
  group: string,
  metric: AchievementMetric,
  icon: string,
  steps: { threshold: number; title: string; desc: string }[],
  unit?: string
): Achievement[] {
  return steps.map((s, i) => ({
    id: `${group}-${s.threshold}`,
    group,
    title: s.title,
    desc: s.desc,
    icon,
    tier: tierFor(i, steps.length),
    metric,
    threshold: s.threshold,
    unit,
  }))
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Trasa ────────────────────────────────────────────────────────────────
  ...ladder('route', 'knownWords', '🗺️', [
    { threshold: 10,     title: 'Pierwsze kroki',   desc: 'Pierwsze 10 słów na trasie.' },
    { threshold: 50,     title: 'Rozgrzewka',        desc: '50 słów za Tobą.' },
    { threshold: 100,    title: 'Pierwsza setka',    desc: 'Pierwszy znacznik na mapie.' },
    { threshold: 250,    title: 'Rozpęd',            desc: '250 słów — to już nie przypadek.' },
    { threshold: 500,    title: 'Pół tysiąca',       desc: 'Połowa drogi do Survival English.' },
    { threshold: 1000,   title: 'Pierwszy tysiąc',   desc: 'Survival English zdobyty.' },
    { threshold: 2000,   title: 'Dwa tysiące',       desc: 'Jedna piąta całej trasy.' },
    { threshold: 3000,   title: 'Trzy tysiące',      desc: 'Everyday English zdobyty.' },
    { threshold: 5000,   title: 'Półmetek',          desc: 'Połowa z 10 000 słów.' },
    { threshold: 6000,   title: 'Sześć tysięcy',     desc: 'Freedom English zdobyty.' },
    { threshold: 10000,  title: 'Koniec trasy',      desc: '10 000 słów. Cała mapa.' },
  ]),

  // ── Seria ────────────────────────────────────────────────────────────────
  ...ladder('streak', 'streak', '🔥', [
    { threshold: 3,   title: 'Trzy dni',       desc: '3 dni z rzędu.' },
    { threshold: 7,   title: 'Tydzień',        desc: '7 dni z rzędu.' },
    { threshold: 14,  title: 'Dwa tygodnie',   desc: '14 dni z rzędu.' },
    { threshold: 30,  title: 'Miesiąc',        desc: '30 dni z rzędu.' },
    { threshold: 60,  title: 'Dwa miesiące',   desc: '60 dni z rzędu.' },
    { threshold: 100, title: 'Setka dni',      desc: '100 dni z rzędu.' },
    { threshold: 365, title: 'Cały rok',       desc: '365 dni z rzędu.' },
  ]),

  // ── Słuchanie ────────────────────────────────────────────────────────────
  ...ladder('listening', 'wordsHeard', '🎧', [
    { threshold: 100,   title: 'Ucho przy głośniku', desc: '100 słów odsłuchanych.' },
    { threshold: 500,   title: 'Słuchacz',           desc: '500 słów odsłuchanych.' },
    { threshold: 1000,  title: 'Tysiąc w uszach',    desc: '1 000 słów odsłuchanych.' },
    { threshold: 5000,  title: 'Stały bywalec',      desc: '5 000 słów odsłuchanych.' },
    { threshold: 10000, title: 'Dziesięć tysięcy',   desc: '10 000 słów odsłuchanych.' },
    { threshold: 25000, title: 'Radio w głowie',     desc: '25 000 słów odsłuchanych.' },
  ]),

  // ── Czas ─────────────────────────────────────────────────────────────────
  ...ladder('time', 'minutes', '⏱️', [
    { threshold: 60,   title: 'Pierwsza godzina', desc: '60 minut nauki.' },
    { threshold: 300,  title: 'Pięć godzin',      desc: '300 minut nauki.' },
    { threshold: 600,  title: 'Dziesięć godzin',  desc: '600 minut nauki.' },
    { threshold: 1200, title: 'Dwadzieścia godzin', desc: '1 200 minut nauki.' },
    { threshold: 3000, title: 'Pięćdziesiąt godzin', desc: '3 000 minut nauki.' },
  ], 'min'),

  // ── Cel dnia ─────────────────────────────────────────────────────────────
  ...ladder('goal', 'goalDays', '🎯', [
    { threshold: 1,   title: 'Pierwszy cel',   desc: 'Cel dnia osiągnięty po raz pierwszy.' },
    { threshold: 5,   title: 'Pięć celów',     desc: '5 dni z osiągniętym celem.' },
    { threshold: 25,  title: 'Dwadzieścia pięć', desc: '25 dni z osiągniętym celem.' },
    { threshold: 100, title: 'Setka celów',    desc: '100 dni z osiągniętym celem.' },
    { threshold: 365, title: 'Rok na celu',    desc: '365 dni z osiągniętym celem.' },
  ]),

  // ── Powtórki ─────────────────────────────────────────────────────────────
  ...ladder('review', 'reviews', '🔁', [
    { threshold: 10,   title: 'Pierwsze powtórki', desc: '10 słów utrzymanych w powtórce.' },
    { threshold: 50,   title: 'Utrwalacz',         desc: '50 słów utrzymanych.' },
    { threshold: 200,  title: 'Nic nie ucieka',    desc: '200 słów utrzymanych.' },
    { threshold: 1000, title: 'Pamięć ze stali',   desc: '1 000 słów utrzymanych.' },
  ]),

  // ── Czysta trasa ─────────────────────────────────────────────────────────
  ...ladder('clean', 'cleanDays', '🧊', [
    { threshold: 7,  title: 'Czysty tydzień',  desc: '7 dni z porcją powtórek na czas.' },
    { threshold: 30, title: 'Czysty miesiąc',  desc: '30 dni z porcją powtórek na czas.' },
    { threshold: 90, title: 'Czysty kwartał',  desc: '90 dni z porcją powtórek na czas.' },
  ]),

  // ── Paczki ───────────────────────────────────────────────────────────────
  ...ladder('packs', 'masteredPacks', '📦', [
    { threshold: 1,   title: 'Pierwsza paczka', desc: 'Pierwsza paczka opanowana.' },
    { threshold: 5,   title: 'Pięć paczek',     desc: '5 paczek opanowanych.' },
    { threshold: 10,  title: 'Dziesięć paczek', desc: '10 paczek opanowanych.' },
    { threshold: 25,  title: 'Ćwierć setki',    desc: '25 paczek opanowanych.' },
    { threshold: 50,  title: 'Pięćdziesiąt',    desc: '50 paczek opanowanych.' },
    { threshold: 100, title: 'Setka paczek',    desc: '100 paczek opanowanych.' },
    { threshold: 250, title: 'Ćwierć tysiąca',  desc: '250 paczek opanowanych.' },
    { threshold: 500, title: 'Pół tysiąca',     desc: '500 paczek opanowanych.' },
    { threshold: 864, title: 'Wszystkie',       desc: 'Wszystkie 864 paczki opanowane.' },
  ]),

  // ── Mówienie ─────────────────────────────────────────────────────────────
  ...ladder('speaking', 'speakingSessions', '🗣️', [
    { threshold: 1,   title: 'Pierwsze słowo',  desc: 'Pierwsza sesja w trybie mówienia.' },
    { threshold: 10,  title: 'Rozgadany',       desc: '10 sesji mówienia.' },
    { threshold: 25,  title: 'Coraz śmielej',   desc: '25 sesji mówienia.' },
    { threshold: 50,  title: 'Głos w rozmowie', desc: '50 sesji mówienia.' },
    { threshold: 100, title: 'Mówca',           desc: '100 sesji mówienia.' },
  ]),

  // ── Rytm dnia ────────────────────────────────────────────────────────────
  {
    id: 'rhythm-early', group: 'rhythm', title: 'Ranny ptaszek',
    desc: '10 sesji rozpoczętych przed 8:00.', icon: '🌅',
    tier: 'silver', metric: 'earlySessions', threshold: 10,
  },
  {
    id: 'rhythm-night', group: 'rhythm', title: 'Nocny marek',
    desc: '10 sesji po 22:00.', icon: '🌙',
    tier: 'silver', metric: 'nightSessions', threshold: 10,
  },
  {
    id: 'rhythm-weekend', group: 'rhythm', title: 'Weekendowiec',
    desc: '4 weekendy z rzędu z nauką.', icon: '📅',
    tier: 'gold', metric: 'weekendRun', threshold: 4,
  },

  // ── Tempo ────────────────────────────────────────────────────────────────
  {
    id: 'pace-sprint', group: 'pace', title: 'Sprint',
    desc: '100 słów w jeden dzień.', icon: '⚡',
    tier: 'gold', metric: 'bestDay', threshold: 100,
  },
  {
    id: 'pace-marathon', group: 'pace', title: 'Maraton',
    desc: 'Jedna sesja na 60 słów.', icon: '🏃',
    tier: 'silver', metric: 'longestSession', threshold: 60,
  },
  {
    id: 'pace-halfcentury', group: 'pace', title: 'Pięćdziesiątka',
    desc: '50 słów w jeden dzień.', icon: '💨',
    tier: 'bronze', metric: 'bestDay', threshold: 50,
  },

  // ── Eksploracja ──────────────────────────────────────────────────────────
  ...ladder('explore', 'volumesDone', '🧭', [
    { threshold: 1, title: 'Pierwszy Tom',   desc: 'Cały Tom opanowany.' },
    { threshold: 3, title: 'Trzy Tomy',      desc: '3 Tomy opanowane.' },
    { threshold: 6, title: 'Sześć Tomów',    desc: '6 Tomów opanowanych.' },
    { threshold: 9, title: 'Wszystkie Tomy', desc: 'Wszystkie 9 Tomów opanowanych.' },
  ]),
  {
    id: 'explore-chapters', group: 'explore', title: 'Dziesięć rozdziałów',
    desc: '10 rozdziałów opanowanych.', icon: '📖',
    tier: 'silver', metric: 'chaptersDone', threshold: 10,
  },
  {
    id: 'explore-categories', group: 'explore', title: 'Wszędzie byłem',
    desc: 'Każda z 12 kategorii zaczęta.', icon: '🌍',
    tier: 'gold', metric: 'categoriesStarted', threshold: 12,
  },
  {
    id: 'explore-category-complete', group: 'explore', title: 'Kompletysta',
    desc: 'Cała jedna kategoria opanowana.', icon: '🏵️',
    tier: 'gold', metric: 'categoryComplete', threshold: 1,
  },

  // ── Etapy ────────────────────────────────────────────────────────────────
  {
    id: 'level-1', group: 'levels', title: 'Survival English',
    desc: '1 000 słów — językowy ekwipunek przetrwania.', icon: '⭐',
    tier: 'bronze', metric: 'knownWords', threshold: 1000,
  },
  {
    id: 'level-2', group: 'levels', title: 'Everyday English',
    desc: '3 000 słów — potrafisz się dogadać.', icon: '⭐',
    tier: 'silver', metric: 'knownWords', threshold: 3000,
  },
  {
    id: 'level-3', group: 'levels', title: 'Freedom English',
    desc: '6 000 słów — angielski staje się narzędziem.', icon: '⭐',
    tier: 'gold', metric: 'knownWords', threshold: 6000,
  },
  {
    id: 'level-4', group: 'levels', title: 'World-Class English',
    desc: '10 000 słów — obywatel świata.', icon: '👑',
    tier: 'legend', metric: 'knownWords', threshold: 10000,
  },
]

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length
