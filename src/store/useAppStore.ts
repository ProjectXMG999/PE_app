import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AutoplayMode, StudyMode } from '../types/progress'
import { emitProgress } from '../services/progressEvents'
import { updateComfort, strongStreakNext, LevelUpPromptState, SessionOutcome, COMFORT } from '../services/comfort'
import {
  ReviewHealth, ReviewOutcome, EMPTY_REVIEW_HEALTH, updateReviewHealth, requestRetentionFor,
} from '../services/reviewHealth'
import { dayKey } from '../utils/day'

type FilterType = 'all' | 'new' | 'started' | 'completed' | 'mastered'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type ThemePreference = 'dark' | 'light' | 'system'

/** Selectable daily study goals, in minutes. A short list, not a slider —
 *  picking a goal should take one tap, not aim. */
export const DAILY_GOAL_OPTIONS = [10, 15, 20, 30, 45, 60] as const

/** The landing promises "your first session takes about 10 minutes", so 15 is
 *  the natural second step rather than an intimidating default. */
export const DEFAULT_DAILY_GOAL_SEC = 15 * 60

/**
 * When a badge was first earned, and whether its celebration has been shown.
 * Achievements themselves are DERIVED from progress data on every read, so this
 * is presentation metadata only — losing it costs a date and an animation, not
 * the badge. That's why it lives here rather than in a synced table.
 */
export interface AchievementUnlock {
  at: string
  seen: boolean
}

/**
 * One streak freeze, replenished every 14 days, spent automatically on a missed
 * day that would otherwise break a streak. `usedOn` holds local day keys and is
 * read by getStreak() — see services/db.ts.
 */
export interface StreakFreeze {
  available: number
  lastGrantedAt: string | null
  usedOn: string[]
}

export const STREAK_FREEZE_INTERVAL_DAYS = 14

/** Resolves the stored preference to the theme actually applied. */
export function resolveTheme(pref: ThemePreference): 'dark' | 'light' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return pref
}

interface AppStore {
  theme: ThemePreference
  setTheme: (t: ThemePreference) => void
  toggleTheme: () => void

  /** Whether the current page wants the ambient WebGL background hidden (focus/
   *  session screens). AmbientBackground now mounts once at the app root — see
   *  its doc comment — so pages fade it via this flag instead of unmounting it,
   *  which would tear down and rebuild the WebGL context on every navigation.
   *  Not persisted: a fresh load always starts visible. */
  ambientHidden: boolean
  setAmbientHidden: (hidden: boolean) => void

  /** A full-screen overlay *inside* a page asking the shell's chrome to stand
   *  down. Distinct from AppShell's hide* props, which are per-route and fixed
   *  at render time — this is set by a child that goes full screen after the
   *  page has already mounted. Not persisted. */
  chromeHidden: boolean
  setChromeHidden: (hidden: boolean) => void

  currentPackageId: string | null
  currentMode: StudyMode | null
  currentCardIndex: number
  revealStep: number
  isAutoPlaying: boolean
  autoplayMode: AutoplayMode
  setAutoplayMode: (m: AutoplayMode) => void
  enRate: number
  plRate: number
  setEnRate: (r: number) => void
  setPlRate: (r: number) => void
  setPackage: (id: string, mode: StudyMode) => void
  setCardIndex: (i: number) => void
  advanceReveal: () => void
  resetReveal: () => void
  setAutoPlaying: (v: boolean) => void

  searchQuery: string
  activeFilter: FilterType | null
  activeCategoryFilter: string | null
  activeLevel: number | null
  activeCategory: string | null
  setSearch: (q: string) => void
  setFilter: (f: FilterType | null) => void
  setCategoryFilter: (cat: string | null) => void
  setLevel: (level: number | null) => void
  setCategory: (cat: string | null) => void

  /** Persisted starting level for the Dziś recommendation engine — distinct
   *  from `activeLevel` above, which is a transient Home browse filter. */
  todayLevel: number | null
  setTodayLevel: (level: number | null) => void

  /** Adaptive difficulty scalar (1.0–4.9), driven by rated Trenuj sessions.
   *  Read by the Inteligentny queue builder. See services/comfort.ts.
   *  Fed by NEW material only (learn / stretch) — how well old words are held
   *  is `reviewHealth`, a separate question with a separate answer. */
  comfortLevel: number
  comfortUpdatedAt: string | null
  /** Consecutive "strong" rated sessions — gates the level-up prompt. */
  strongStreak: number
  levelUpPrompt: LevelUpPromptState
  /** Fold a finished rated session into comfortLevel + strongStreak. */
  applyTrainingOutcome: (s: SessionOutcome) => void

  /** Recall on scheduled reviews. Drives the session's review/new split and the
   *  learner's desired retention. See services/reviewHealth.ts. */
  reviewHealth: ReviewHealth
  /** Fold one batch of scheduled reviews into reviewHealth. Reviews ONLY —
   *  never learn/stretch cards, or the signal measures session composition
   *  instead of memory. */
  applyReviewOutcome: (o: ReviewOutcome) => void
  /** Record that the user was shown (and declined) the level-up prompt. */
  dismissLevelUp: (level: number) => void

  installPromptEvent: BeforeInstallPromptEvent | null
  isInstalled: boolean
  iosBannerDismissed: boolean
  setInstallPrompt: (e: BeforeInstallPromptEvent) => void
  setInstalled: () => void
  dismissIOSBanner: () => void

  swUpdateAvailable: boolean
  setSwUpdateAvailable: (v: boolean) => void
  swRegistration: ServiceWorkerRegistration | null
  setSwRegistration: (r: ServiceWorkerRegistration) => void

  showDebug: boolean
  setShowDebug: (v: boolean) => void

  devUnlocked: boolean
  setDevUnlocked: (v: boolean) => void

  // Experimental: silent looping audio to help the autoplay sequence + Media
  // Session survive a locked screen. Off by default pending device testing.
  keepScreenAudioAlive: boolean
  setKeepScreenAudioAlive: (v: boolean) => void

  /** UI sound effects (ticks/chimes) — separate from vocabulary audio, which
   *  has its own rate controls and is never muted by this. */
  soundEnabled: boolean
  setSoundEnabled: (v: boolean) => void

  /** The breathing pad under Słuchaj (audio/studyPad.ts). On by default — it is
   *  the intended texture of the listening mode, and at −38 dB it sits under
   *  the voice rather than beside it. One toggle in Ustawienia turns it off for
   *  anyone who studies in silence. */
  studyPadEnabled: boolean
  setStudyPadEnabled: (v: boolean) => void

  /** Daily study-time goal, in seconds. */
  dailyGoalSec: number
  setDailyGoalSec: (sec: number) => void

  /** Opt-in reminder at the user's most effective time of day. */
  reminderEnabled: boolean
  reminderHour: number | null
  setReminder: (enabled: boolean, hour: number | null) => void

  streakFreeze: StreakFreeze
  grantStreakFreeze: (today: string) => void
  spendStreakFreeze: (day: string) => void

  achievementUnlocks: Record<string, AchievementUnlock>
  recordUnlocks: (ids: string[], at: string) => void
  markUnlocksSeen: (ids: string[]) => void
}

type PersistedState = Pick<
  AppStore,
  'theme' | 'isInstalled' | 'iosBannerDismissed' | 'autoplayMode' | 'enRate' | 'plRate' | 'showDebug' | 'devUnlocked' | 'keepScreenAudioAlive'
  | 'dailyGoalSec' | 'reminderEnabled' | 'reminderHour' | 'streakFreeze' | 'achievementUnlocks' | 'todayLevel' | 'soundEnabled'
  | 'comfortLevel' | 'comfortUpdatedAt' | 'strongStreak' | 'levelUpPrompt' | 'reviewHealth' | 'studyPadEnabled'
>

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (t) => set({ theme: t }),
      ambientHidden: false,
      setAmbientHidden: (hidden) => set(s => (s.ambientHidden === hidden ? s : { ambientHidden: hidden })),
      chromeHidden: false,
      setChromeHidden: (hidden) => set(s => (s.chromeHidden === hidden ? s : { chromeHidden: hidden })),
      toggleTheme: () => set(s => ({ theme: resolveTheme(s.theme) === 'dark' ? 'light' : 'dark' })),

      currentPackageId: null,
      currentMode: null,
      currentCardIndex: 0,
      revealStep: 0,
      isAutoPlaying: false,
      autoplayMode: 'standard',
      setAutoplayMode: (m) => set({ autoplayMode: m }),
      enRate: 1.0,
      plRate: 1.0,
      setEnRate: (r) => set({ enRate: r }),
      setPlRate: (r) => set({ plRate: r }),
      setPackage: (id, mode) => set({ currentPackageId: id, currentMode: mode, currentCardIndex: 0, revealStep: 0 }),
      setCardIndex: (i) => set({ currentCardIndex: i, revealStep: 0 }),
      advanceReveal: () => set(s => ({ revealStep: s.revealStep + 1 })),
      resetReveal: () => set({ revealStep: 0 }),
      setAutoPlaying: (v) => set({ isAutoPlaying: v }),

      searchQuery: '',
      // "Nowe" is the default status filter when Pakiety opens — the page's job
      // is "what haven't I done yet". Not persisted (see partialize), so it
      // resets to this on every app load; a filter chosen mid-session still
      // survives navigating in and out of a pack.
      activeFilter: 'new',
      activeCategoryFilter: null,
      activeLevel: null,
      activeCategory: null,
      setSearch: (q) => set({ searchQuery: q }),
      setFilter: (f) => set({ activeFilter: f }),
      setCategoryFilter: (cat) => set({ activeCategoryFilter: cat }),
      setLevel: (level) => set({ activeLevel: level }),
      setCategory: (cat) => set({ activeCategory: cat }),

      todayLevel: null,
      setTodayLevel: (level) => set({ todayLevel: level }),

      comfortLevel: COMFORT.MIN,
      comfortUpdatedAt: null,
      strongStreak: 0,
      levelUpPrompt: { dismissedForLevel: null, lastShownAt: null },
      applyTrainingOutcome: (s) =>
        set((state) => ({
          comfortLevel: updateComfort(state.comfortLevel, s),
          strongStreak: strongStreakNext(state.strongStreak, s),
          comfortUpdatedAt: new Date().toISOString(),
        })),
      reviewHealth: EMPTY_REVIEW_HEALTH,
      applyReviewOutcome: (o) =>
        set((state) => ({ reviewHealth: updateReviewHealth(state.reviewHealth, o) })),

      // lastShownAt is a day key (not a full timestamp) — shouldPromptLevelUp's
      // cooldown check compares it with daysBetween(), which expects that format.
      dismissLevelUp: (level) =>
        set({
          levelUpPrompt: { dismissedForLevel: level, lastShownAt: dayKey() },
        }),

      installPromptEvent: null,
      isInstalled: false,
      iosBannerDismissed: false,
      setInstallPrompt: (e) => set({ installPromptEvent: e }),
      setInstalled: () => set({ isInstalled: true, installPromptEvent: null }),
      dismissIOSBanner: () => set({ iosBannerDismissed: true }),

      swUpdateAvailable: false,
      setSwUpdateAvailable: (v) => set({ swUpdateAvailable: v }),
      swRegistration: null,
      setSwRegistration: (r) => set({ swRegistration: r }),

      showDebug: false,
      setShowDebug: (v) => set({ showDebug: v }),

      devUnlocked: false,
      setDevUnlocked: (v) => set(v ? { devUnlocked: true } : { devUnlocked: false, showDebug: false }),

      keepScreenAudioAlive: false,
      setKeepScreenAudioAlive: (v) => set({ keepScreenAudioAlive: v }),

      soundEnabled: true,
      setSoundEnabled: (v) => set({ soundEnabled: v }),

      studyPadEnabled: true,
      setStudyPadEnabled: (v) => set({ studyPadEnabled: v }),

      dailyGoalSec: DEFAULT_DAILY_GOAL_SEC,
      // The Dziś ring reads its goal from useProgressPulse, which caches for
      // up to 60s and only refreshes on a progressEvents write — changing the
      // goal here never touched IndexedDB, so without this the ring kept
      // showing the old minutes for up to a minute after picking a new one.
      setDailyGoalSec: (sec) => {
        set({ dailyGoalSec: sec })
        emitProgress('dailyTime')
      },

      reminderEnabled: false,
      reminderHour: null,
      setReminder: (enabled, hour) => set({ reminderEnabled: enabled, reminderHour: hour }),

      streakFreeze: { available: 1, lastGrantedAt: null, usedOn: [] },
      grantStreakFreeze: (today) =>
        set(s => ({ streakFreeze: { ...s.streakFreeze, available: 1, lastGrantedAt: today } })),
      spendStreakFreeze: (day) =>
        set(s =>
          s.streakFreeze.available < 1 || s.streakFreeze.usedOn.includes(day)
            ? s
            : {
                streakFreeze: {
                  ...s.streakFreeze,
                  available: s.streakFreeze.available - 1,
                  usedOn: [...s.streakFreeze.usedOn, day],
                },
              }
        ),

      achievementUnlocks: {},
      // Only ever adds — a badge already recorded keeps its original date, so
      // re-deriving achievements on every load can't rewrite history.
      recordUnlocks: (ids, at) =>
        set(s => {
          const next = { ...s.achievementUnlocks }
          let changed = false
          for (const id of ids) {
            if (next[id] == null) {
              next[id] = { at, seen: false }
              changed = true
            }
          }
          return changed ? { achievementUnlocks: next } : s
        }),
      markUnlocksSeen: (ids) =>
        set(s => {
          const next = { ...s.achievementUnlocks }
          let changed = false
          for (const id of ids) {
            const entry = next[id]
            if (entry && !entry.seen) {
              next[id] = { ...entry, seen: true }
              changed = true
            }
          }
          return changed ? { achievementUnlocks: next } : s
        }),
    }),
    {
      name: 'pe-store',
      version: 5,
      migrate: (persisted) => {
        const s = (persisted ?? {}) as Partial<PersistedState>
        return {
          ...s,
          // v3: playback tempo is 100% everywhere by default. The code default
          // always was 1.0, but "Wolniej" in the listening player writes a
          // *persisted, global* preference — so one tap during one session left
          // every later session, in every mode, permanently slowed down with no
          // hint of why. This resets both rates once; the picker in Ustawienia
          // and in the player still changes them deliberately.
          // (It also subsumes the v0→v1 migration off absolute rates like 0.60,
          // which snapped off-scale values back to 1.0.)
          enRate: 1.0,
          plRate: 1.0,
          // v2: adaptive difficulty. Seed comfort from the manually chosen
          // starting level so an existing learner doesn't start at 1.0.
          comfortLevel: s.comfortLevel ?? (s.todayLevel ?? 1),
          comfortUpdatedAt: s.comfortUpdatedAt ?? null,
          strongStreak: s.strongStreak ?? 0,
          levelUpPrompt: s.levelUpPrompt ?? { dismissedForLevel: null, lastShownAt: null },
          // v4: review health starts empty for everyone. It could be seeded
          // from lapseCount/reviewCount totals, but those are lifetime figures
          // and this signal is deliberately recent — better a couple of weeks
          // of baseline behaviour than a number fitted to two-year-old answers.
          reviewHealth: s.reviewHealth ?? EMPTY_REVIEW_HEALTH,
          // v5: the listening drone flips on by default. A forced reset rather
          // than `?? true`, and that is only defensible because the setting was
          // introduced and re-defaulted inside a single unreleased change — no
          // user has ever deliberately chosen "off", so there is no preference
          // to overwrite. Anyone who wants silence turns it off once, in
          // Ustawienia, and that choice then persists normally.
          studyPadEnabled: true,
        }
      },
      partialize: (s) => ({
        theme: s.theme,
        isInstalled: s.isInstalled,
        iosBannerDismissed: s.iosBannerDismissed,
        autoplayMode: s.autoplayMode,
        enRate: s.enRate,
        plRate: s.plRate,
        showDebug: s.showDebug,
        devUnlocked: s.devUnlocked,
        keepScreenAudioAlive: s.keepScreenAudioAlive,
        dailyGoalSec: s.dailyGoalSec,
        reminderEnabled: s.reminderEnabled,
        reminderHour: s.reminderHour,
        streakFreeze: s.streakFreeze,
        achievementUnlocks: s.achievementUnlocks,
        todayLevel: s.todayLevel,
        soundEnabled: s.soundEnabled,
        studyPadEnabled: s.studyPadEnabled,
        comfortLevel: s.comfortLevel,
        comfortUpdatedAt: s.comfortUpdatedAt,
        strongStreak: s.strongStreak,
        levelUpPrompt: s.levelUpPrompt,
        reviewHealth: s.reviewHealth,
      }),
    }
  )
)

/**
 * The desired retention to schedule with right now — the review-health loop's
 * output, read at the moment a word is graded rather than held in a component.
 *
 * Lives here rather than in reviewHealth.ts (which stays pure and store-free,
 * so it can be tested as maths) and out of review.ts (documented no-IO).
 */
export function currentRequestRetention(): number {
  return requestRetentionFor(useAppStore.getState().reviewHealth)
}
