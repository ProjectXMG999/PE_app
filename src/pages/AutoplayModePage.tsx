import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAppStore } from '../store/useAppStore'
import { unlockAudioGlobally } from '../audio/audioUnlock'
import { unlockKeepAlive } from '../audio/keepAlive'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import { AutoplayMode } from '../types/progress'
import './AutoplayModePage.css'

const allPacks = packagesIndex as PackMeta[]

const MODES: { id: AutoplayMode; icon: string; name: string; sequence: string; desc: string }[] = [
  {
    id: 'fast',
    icon: '⚡',
    name: 'Słowa',
    sequence: 'PL → EN',
    desc: 'Szybka powtórka. Usłysz polskie słowo, przypomnij sobie angielskie i powtórz.',
  },
  {
    id: 'standard',
    icon: '⭐',
    name: 'Standard',
    sequence: 'Słowo + zdanie',
    desc: 'Słowo i zdanie w kontekście. Najlepszy tryb do regularnej nauki.',
  },
  {
    id: 'speaking',
    icon: '🎙️',
    name: 'Mówienie',
    sequence: 'PL słowo → pauza → EN słowo → pauza → zdania',
    desc: 'Powiedz, zanim usłyszysz. Przypomnij sobie słowo, zbuduj zdanie i mów na głos.',
  },
]

export function AutoplayModePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const { setAutoplayMode } = useAppStore()
  const [infoOpen, setInfoOpen] = useState(false)

  const pack = allPacks.find(p => p.id === packageId)

  const handleSelect = (mode: AutoplayMode) => {
    // Unlock iOS audio NOW while we're in a synchronous user gesture context
    // Using AudioContext.resume() which permanently unlocks audio for the session
    unlockAudioGlobally()
    // Also unlock the keep-alive element within the same gesture (used only
    // when the experimental keep-alive is enabled via keepScreenAudioAlive)
    unlockKeepAlive()
    console.log('[action] autoplay mode selected, audio unlock called')
    setAutoplayMode(mode)
    navigate(`/pakiet/${packageId}/autoplay`)
  }

  return (
    <AppShell hideBottomNav hideSidebar={false}>
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

        <div className="autoplay-mode__info">
          <button
            type="button"
            className="autoplay-mode__info-toggle"
            onClick={() => setInfoOpen(o => !o)}
            aria-expanded={infoOpen}
          >
            <span>Jak działa tryb Słuchaj?</span>
            <svg
              className={`autoplay-mode__info-chevron${infoOpen ? ' autoplay-mode__info-chevron--open' : ''}`}
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {infoOpen && (
            <p className="autoplay-mode__info-desc">
              Trening audio bez patrzenia w ekran. Słuchasz, przypominasz sobie i powtarzasz słowa oraz zdania. Idealny na spacer, trening, sprzątanie lub podróż.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  )
}
