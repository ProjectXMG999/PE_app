import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './FlashcardModePage.css'

const allPacks = packagesIndex as PackMeta[]

type FlashcardMode = 'word-flash' | 'active-sentence'

const MODES: { id: FlashcardMode; icon: string; name: string; tag: string; desc: string }[] = [
  {
    id: 'word-flash',
    icon: '⚡',
    name: 'Word Flash',
    tag: 'Szybki przegląd słów',
    desc: 'Widzisz polskie słowo, próbujesz przypomnieć sobie angielski odpowiednik i dopiero potem odsłaniasz odpowiedź. Szybka rozgrzewka dla pamięci.',
  },
  {
    id: 'active-sentence',
    icon: '🧠',
    name: 'Active Sentence',
    tag: 'Aktywacja zdań',
    desc: 'Widzisz polskie zdanie i budujesz angielską odpowiedź, zanim ją odsłonisz. Trudniejsze, ale tutaj zaczyna się prawdziwe mówienie.',
  },
]

export function FlashcardModePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()

  const pack = allPacks.find(p => p.id === packageId)

  return (
    <AppShell hideBottomNav>
      <div className="fc-mode">
        <div className="fc-mode__header">
          <button
            className="fc-mode__back"
            onClick={() => navigate(packageId ? `/pakiet/${packageId}` : '/')}
            aria-label="Wróć do pakietu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span className="fc-mode__back-label">Pakiet</span>
          </button>
          <span className="fc-mode__pack-name">{pack?.name ?? packageId}</span>
        </div>

        <h1 className="fc-mode__title">Wybierz tryb nauki</h1>

        <div className="fc-mode__cards">
          {MODES.map(m => (
            <button
              key={m.id}
              className="fc-mode__card"
              onClick={() => navigate(`/pakiet/${packageId}/${m.id}`)}
            >
              <div className="fc-mode__card-header">
                <span className="fc-mode__card-icon">{m.icon}</span>
                <div className="fc-mode__card-titles">
                  <span className="fc-mode__card-name">{m.name}</span>
                  <span className="fc-mode__card-tag">{m.tag}</span>
                </div>
                <svg className="fc-mode__card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
              <p className="fc-mode__card-desc">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
