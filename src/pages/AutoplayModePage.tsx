import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAppStore } from '../store/useAppStore'
import { unlockAudioGlobally } from '../audio/audioUnlock'
import { unlockKeepAlive } from '../audio/keepAlive'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './AutoplayModePage.css'

const allPacks = packagesIndex as PackMeta[]

type AutoplayMode = 'fast' | 'standard' | 'speaking'

const MODES: { id: AutoplayMode; icon: string; name: string; sequence: string; desc: string }[] = [
  {
    id: 'fast',
    icon: '🚀',
    name: 'Szybko',
    sequence: 'PL → EN',
    desc: 'Błyskawiczna powtórka słów. Idealne na rozgrzewkę, utrwalenie i szybkie sprawdzenie pamięci.',
  },
  {
    id: 'standard',
    icon: '★',
    name: 'Standard',
    sequence: 'Słowo + zdanie',
    desc: 'Główny tryb nauki. Słyszysz słowo, tłumaczenie i przykład w zdaniu, żeby od razu poczuć kontekst.',
  },
  {
    id: 'speaking',
    icon: '🎙',
    name: 'Speaking',
    sequence: 'PL słowo → pauza → EN słowo → pauza → zdania',
    desc: 'Tryb z dłuższymi pauzami. Powtarzasz na głos, zanim usłyszysz odpowiedź. Najbliżej prawdziwego mówienia.',
  },
]

export function AutoplayModePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const { setAutoplayMode } = useAppStore()

  const pack = allPacks.find(p => p.id === packageId)

  const handleSelect = (mode: AutoplayMode) => {
    // Unlock iOS audio NOW while we're in a synchronous user gesture context
    // Using AudioContext.resume() which permanently unlocks audio for the session
    unlockAudioGlobally()
    // Also unlock the keep-alive element within the same gesture (used only
    // when the experimental keep-alive is enabled via showDebug)
    unlockKeepAlive()
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
