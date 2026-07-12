import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAppStore } from '../store/useAppStore'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './AutoplayModePage.css'

const allPacks = packagesIndex as PackMeta[]

type AutoplayMode = 'fast' | 'standard' | 'speaking'

const MODES: { id: AutoplayMode; icon: string; name: string; sequence: string; desc: string }[] = [
  {
    id: 'fast',
    icon: '⚡',
    name: 'Szybko',
    sequence: 'PL słowo → EN słowo',
    desc: 'Szybkie rozpoznanie i powtórka',
  },
  {
    id: 'standard',
    icon: '★',
    name: 'Standard',
    sequence: 'PL słowo → EN słowo ×2 → PL zdanie → EN zdanie',
    desc: 'Główny tryb nauki — pełna sekwencja',
  },
  {
    id: 'speaking',
    icon: '🎙',
    name: 'Speaking',
    sequence: 'PL słowo → [pauza] → EN słowo → [pauza] → zdania',
    desc: 'Dłuższe pauzy do ćwiczenia mówienia na głos',
  },
]

export function AutoplayModePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const { setAutoplayMode, audioUnlockFn } = useAppStore()

  const pack = allPacks.find(p => p.id === packageId)

  const handleSelect = (mode: AutoplayMode) => {
    // Unlock iOS audio NOW while we're in a synchronous user gesture context
    // This ensures audio.play() will succeed when the sequence starts
    audioUnlockFn?.()
    console.log('[action] autoplay mode selected, audio unlock called')
    setAutoplayMode(mode)
    navigate(`/pakiet/${packageId}/autoplay`)
  }

  return (
    <AppShell hideBottomNav>
      <div className="autoplay-mode">
        <div className="autoplay-mode__header">
          <button
            className="autoplay-mode__back"
            onClick={() => navigate(packageId ? `/pakiet/${packageId}` : '/')}
            aria-label="Wróć do pakietu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span className="autoplay-mode__back-label">Pakiet</span>
          </button>
          <span className="autoplay-mode__pack-name">{pack?.name ?? packageId}</span>
        </div>

        <h1 className="autoplay-mode__title">Wybierz tryb słuchania</h1>

        <div className="autoplay-mode__cards">
          {MODES.map(m => (
            <button
              key={m.id}
              className="autoplay-mode__card"
              onClick={() => handleSelect(m.id)}
            >
              <span className="autoplay-mode__card-icon">{m.icon}</span>
              <div className="autoplay-mode__card-body">
                <span className="autoplay-mode__card-name">{m.name}</span>
                <span className="autoplay-mode__card-sequence">{m.sequence}</span>
                <span className="autoplay-mode__card-desc">{m.desc}</span>
              </div>
              <svg className="autoplay-mode__card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
