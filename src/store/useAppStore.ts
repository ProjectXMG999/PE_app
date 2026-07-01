import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { StudyMode } from '../types/progress'

type FilterType = 'all' | 'new' | 'started' | 'completed' | 'mastered'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface AppStore {
  theme: 'dark' | 'light'
  toggleTheme: () => void

  currentPackageId: string | null
  currentMode: StudyMode | null
  currentCardIndex: number
  revealStep: number
  isAutoPlaying: boolean
  autoplayMode: 'fast' | 'standard' | 'speaking'
  setAutoplayMode: (m: 'fast' | 'standard' | 'speaking') => void
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
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      currentPackageId: null,
      currentMode: null,
      currentCardIndex: 0,
      revealStep: 0,
      isAutoPlaying: false,
      autoplayMode: 'standard',
      setAutoplayMode: (m) => set({ autoplayMode: m }),
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
    }),
    {
      name: 'pe-store',
      partialize: (s) => ({
        theme: s.theme,
        isInstalled: s.isInstalled,
        iosBannerDismissed: s.iosBannerDismissed,
        autoplayMode: s.autoplayMode,
      }),
    }
  )
)
