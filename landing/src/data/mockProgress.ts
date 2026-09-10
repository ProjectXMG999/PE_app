// Fake, realistic data for one consistent "engaged learner" persona, fed to
// every reused progress/ component on the landing page. Numbers are chosen
// to agree with each other and with the testimonial in copywriting_lp.txt
// section 8 ("316 → 1221 słów w 90 dni").
import { dayKey, shiftDay } from '../utils/day'
import { evaluateAchievements, type AchievementState } from '../services/achievements'
import { retentionBreakdown } from '../services/reviewQueue'
import type { Session, WordProgress, PackageProgress, DailyTime, ReviewLedgerEntry, DayActivity } from '../types/progress'
import type { PackMeta } from '../types/vocabulary'
import type { ProgressSnapshot, ReadinessResult } from '../types/mockSnapshot'

// ── Core persona numbers — reused across every section ──────────────────────
export const PERSONA = {
  knownWords: 1221,
  streak: 12,
  points: 3840,
  currentWordsPerDay: 34,
  wordsPerMinute: 0.8,
  paceDeltaPct: 18,
} as const

const TODAY = dayKey()

// Small deterministic PRNG so the generated data is stable across renders/builds
// (Math.random() would redraw the heatmap/retention split on every reload).
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260828)

// ── Sessions: ~90 days of history ending today, weighted toward evenings and
// weekends, with a few genuine rest days so the streak/heatmap don't look
// suspiciously perfect. ──────────────────────────────────────────────────────
const sessions: Session[] = []
const dailyTime: DailyTime[] = []
const reviewLedger: ReviewLedgerEntry[] = []
const activity: DayActivity[] = []

for (let i = 89; i >= 0; i--) {
  const date = shiftDay(-i, TODAY)
  const dow = new Date(date + 'T12:00:00').getDay() // 0=Sun..6=Sat
  const isWeekend = dow === 0 || dow === 6
  const isRestDay = rng() < 0.15 && i > 2 // never skip the last couple of days — keeps the streak alive

  if (isRestDay) {
    activity.push({ date, count: 0 })
    continue
  }

  const baseWords = isWeekend ? 28 + Math.floor(rng() * 30) : 14 + Math.floor(rng() * 22)
  const wordsCompleted = Math.max(4, baseWords)
  const hour = isWeekend ? 10 + Math.floor(rng() * 10) : 18 + Math.floor(rng() * 5)
  const durationSec = Math.round(wordsCompleted * (6 + rng() * 6))

  sessions.push({
    packageId: `pack-${(i % 40) + 1}`,
    date,
    startedAt: `${date}T${String(hour).padStart(2, '0')}:${String(Math.floor(rng() * 60)).padStart(2, '0')}:00.000Z`,
    wordsCompleted,
    mode: rng() < 0.55 ? 'autoplay' : 'fiszki',
    autoplayMode: rng() < 0.2 ? 'speaking' : rng() < 0.5 ? 'standard' : 'fast',
    trainMode: rng() < 0.3 ? 'word-flash' : rng() < 0.6 ? 'active-sentence' : 'review',
    durationSec,
  })

  dailyTime.push({
    date,
    secondsStudied: durationSec,
    goalSec: 15 * 60,
    goalMetAt: durationSec >= 15 * 60 ? `${date}T20:00:00.000Z` : null,
  })

  reviewLedger.push({ date, cleared: true, clearedAt: `${date}T21:00:00.000Z` })
  activity.push({ date, count: wordsCompleted })
}

export const activityHeatmapData: DayActivity[] = activity
export const frozenDaysData: string[] = [shiftDay(-31, TODAY)]

// ── Synthetic PackageProgress — enough packs to make masteredPacks/volumesDone
// counts believable without needing the real 866-pack index. ────────────────
const TOTAL_PACKS = 60
const MASTERED_PACKS = 14
const packageProgress: PackageProgress[] = Array.from({ length: TOTAL_PACKS }, (_, i) => {
  const mastered = i < MASTERED_PACKS
  const started = mastered || i < MASTERED_PACKS + 10
  return {
    packageId: `pack-${i + 1}`,
    startedAt: started ? shiftDay(-(80 - i), TODAY) : shiftDay(-1, TODAY),
    completedAt: mastered ? shiftDay(-(60 - i), TODAY) : null,
    masteredAt: mastered ? shiftDay(-(50 - i), TODAY) : null,
    currentIndex: started ? Math.floor(rng() * 10) : 0,
  }
})

const allPacks: PackMeta[] = Array.from({ length: TOTAL_PACKS }, (_, i) => ({
  id: `pack-${i + 1}`,
  name: `Pakiet ${i + 1}`,
  volume: `Tom ${Math.floor(i / 10) + 1}`,
  level: i < 20 ? 1 : i < 40 ? 2 : i < 55 ? 3 : 4,
  category: ['Czasowniki', 'Rzeczowniki', 'Przymiotniki', 'Phrasale'][i % 4],
  wordCount: 20,
  chapter: `Rozdział ${Math.floor(i / 5) + 1}`,
}))

const knownMap = new Map<string, number>(
  packageProgress.map(p => [p.packageId, p.masteredAt != null ? 20 : Math.floor(rng() * 12)])
)

// ── ~1221 synthetic WordProgress entries feeding RetentionBars, drawn from a
// realistic memory-strength distribution (60% high, 25% mid, 15% low). Run
// through the REAL retentionBreakdown() so the tier percentages are computed,
// not hand-picked, and always sum to 100. ────────────────────────────────────
const wordProgress: WordProgress[] = Array.from({ length: PERSONA.knownWords }, (_, i) => {
  const roll = rng()
  const stability = roll < 0.6
    ? 90 + rng() * 275   // high: 90–365d
    : roll < 0.85
      ? 20 + rng() * 70  // mid: 20–90d
      : 3 + rng() * 17   // low: 3–20d
  const retiredAt = stability >= 365 && rng() < 0.4 ? shiftDay(-Math.floor(rng() * 60), TODAY) : undefined
  return {
    wordId: `word-${i}`,
    packageId: `pack-${(i % TOTAL_PACKS) + 1}`,
    seenCount: 3 + Math.floor(rng() * 12),
    lastSeen: shiftDay(-Math.floor(rng() * 30), TODAY),
    status: 'known',
    reviewCount: 1 + Math.floor(rng() * 5),
    nextReviewAt: shiftDay(Math.floor(rng() * 20), TODAY),
    stability,
    difficulty: 3 + rng() * 5,
    retiredAt,
  }
})

export const wordProgressData: WordProgress[] = wordProgress
export const retentionBreakdownData = retentionBreakdown(wordProgress)

// ── ProgressSnapshot — feeds services/achievements.ts + services/points.ts via
// evaluateAchievements(), so the badge grid's unlocked/locked mix is computed
// by the real ladder logic, not hand-picked. ─────────────────────────────────
export const mockSnapshot: ProgressSnapshot = {
  sessions,
  knownTotal: PERSONA.knownWords,
  reviewTotal: 340,
  retiredCount: wordProgress.filter(w => w.retiredAt != null).length,
  packageProgress,
  wordProgress,
  reviewLedger,
  streak: PERSONA.streak,
  knownMap,
}

const achievementResult = evaluateAchievements({
  snapshot: mockSnapshot,
  allPacks,
  dailyTime,
  longestStreak: 18,
  bestDayCount: 61,
})

export const achievementStates: AchievementState[] = achievementResult.states

// ── CompassHero ──────────────────────────────────────────────────────────────
export const compassHeroData = {
  knownWords: PERSONA.knownWords,
  streak: PERSONA.streak,
  points: PERSONA.points,
  pace: { current: PERSONA.currentWordsPerDay, deltaPct: PERSONA.paceDeltaPct },
  guidance: 'Przy tym tempie jesteś 9 dni od Everyday English.',
  loading: false,
}

// ── RouteMap — Survival English (1000) reached, others ahead ────────────────
export const routeMapData = {
  knownWords: PERSONA.knownWords,
  reachedAt: { 1: shiftDay(-87, TODAY) } as Record<number, string | undefined>,
}

// ── PaceSimulator ─────────────────────────────────────────────────────────
export const paceSimulatorData = {
  knownWords: PERSONA.knownWords,
  wordsPerMinute: PERSONA.wordsPerMinute,
  currentWordsPerDay: PERSONA.currentWordsPerDay,
}

// ── ReadinessBreakdown — one visibly weaker part (mówienie) is more credible
// than flat-90s, and exercises the component's own weakest-part callout. ────
export const readinessData: ReadinessResult = {
  score: 74,
  breakdown: {
    swiezosc: 88,
    retencja: 71,
    regularnosc: 80,
    mowienie: 45,
    skutecznosc: 86,
  },
}

// ── WeeklyRecapCard — one representative week, reusing 2 already-unlocked
// achievement states as "new badges" this week. ─────────────────────────────
const unlockedForRecap = achievementStates.filter(s => s.unlocked).slice(-2)

export const weeklyRecapData = {
  from: shiftDay(-6, TODAY),
  to: TODAY,
  wordsPractised: 238,
  minutes: 96,
  sessions: 6,
  activeDays: 6,
  goalDays: 5,
  bestDay: { date: shiftDay(-3, TODAY), count: 61 },
  newBadges: unlockedForRecap,
  toNextStation: 3779,
  nextStationName: 'Freedom English',
  knownTotal: PERSONA.knownWords,
}
