import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AutoplayMode, StudyMode } from '../types/progress'
import { emitProgress } from '../services/progressEvents'

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
>

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (t) => set({ theme: t }),
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
      version: 1,
      migrate: (persisted) => {
        // v0 stored absolute audio rates (e.g. 0.60); v1 uses multipliers
        // from a fixed scale — snap anything off-scale back to 1.0.
        const VALID_RATES = new Set([0.5, 0.75, 1.0, 1.25, 1.5])
        const s = (persisted ?? {}) as PersistedState
        return {
          ...s,
          enRate: s.enRate != null && VALID_RATES.has(s.enRate) ? s.enRate : 1.0,
          plRate: s.plRate != null && VALID_RATES.has(s.plRate) ? s.plRate : 1.0,
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
      }),
    }
  )
)
