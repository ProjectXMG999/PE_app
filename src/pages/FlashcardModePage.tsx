import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './FlashcardModePage.css'

const allPacks = packagesIndex as PackMeta[]

type FlashcardMode = 'word-flash' | 'active-sentence'

const MODES: { id: FlashcardMode; icon: string; name: string; sequence: string; desc: string }[] = [
  {
    id: 'word-flash',
    icon: '⚡',
    name: 'Word Flash',
    sequence: 'PL słowo → flip → EN słowo + wymowa',
    desc: 'Szybki przegląd — buduj poczucie progresu',
  },
  {
    id: 'active-sentence',
    icon: '🧠',
    name: 'Active Sentence',
    sequence: 'PL zdanie → powiedz po ang → flip → EN zdanie',
    desc: 'Głębokie uczenie w kontekście zdania',
  },
]

export function FlashcardModePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<FlashcardMode>('active-sentence')

  const pack = allPacks.find(p => p.id === packageId)

  return (
    <AppShell hideBottomNav>
      <div className="fc-mode">
        <div className="fc-mode__header">
          <button className="fc-mode__back" onClick={() => navigate(-1)} aria-label="Wróć">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="fc-mode__pack-name">{pack?.name ?? packageId}</span>
        </div>

        <h1 className="fc-mode__title">Wybierz tryb fiszek</h1>

        <div className="fc-mode__cards">
          {MODES.map(m => (
            <button
              key={m.id}
              className={`fc-mode__card ${selected === m.id ? 'fc-mode__card--active' : ''}`}
              onClick={() => setSelected(m.id)}
            >
              <span className="fc-mode__card-icon">{m.icon}</span>
              <div className="fc-mode__card-body">
                <span className="fc-mode__card-name">{m.name}</span>
                <span className="fc-mode__card-sequence">{m.sequence}</span>
                <span className="fc-mode__card-desc">{m.desc}</span>
              </div>
              {selected === m.id && (
                <span className="fc-mode__card-check">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          className="fc-mode__start"
          onClick={() => navigate(`/pakiet/${packageId}/${selected}`)}
        >
          Rozpocznij
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </AppShell>
  )
}
