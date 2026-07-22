import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { StudyMode } from '../types/progress'

type FilterType = 'all' | 'new' | 'started' | 'completed' | 'mastered'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type ThemePreference = 'dark' | 'light' | 'system'

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
  autoplayMode: 'fast' | 'standard' | 'speaking'
  setAutoplayMode: (m: 'fast' | 'standard' | 'speaking') => void
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
  activeFilter: FilterType
  activeCategoryFilter: string | null
  activeLevel: number | null
  activeCategory: string | null
  setSearch: (q: string) => void
  setFilter: (f: FilterType) => void
  setCategoryFilter: (cat: string | null) => void
  setLevel: (level: number | null) => void
  setCategory: (cat: string | null) => void

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
}

type PersistedState = Pick<
  AppStore,
  'theme' | 'isInstalled' | 'iosBannerDismissed' | 'autoplayMode' | 'enRate' | 'plRate' | 'showDebug' | 'devUnlocked'
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
      activeFilter: 'all',
      activeCategoryFilter: null,
      activeLevel: null,
      activeCategory: null,
      setSearch: (q) => set({ searchQuery: q }),
      setFilter: (f) => set({ activeFilter: f }),
      setCategoryFilter: (cat) => set({ activeCategoryFilter: cat }),
      setLevel: (level) => set({ activeLevel: level }),
      setCategory: (cat) => set({ activeCategory: cat }),

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
      }),
    }
  )
)
