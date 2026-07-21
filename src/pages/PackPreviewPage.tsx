import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pack, PackMeta } from '../types/vocabulary'
import { PackageProgress } from '../types/progress'
import { getPackageProgress } from '../services/db'
import packagesIndex from '../data/packages-index.json'
import './PackPreviewPage.css'

const allPacks = packagesIndex as PackMeta[]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const MODE_INFO = {
  sluchaj: {
    title: 'Słuchaj',
    icon: '🎧',
    desc: 'Tryb audio do osłuchania, powtórki i nauki w tle. Uczysz się słów bez patrzenia w ekran. Idealne w aucie, na spacerze, na siłowni, w poczekalni albo w metrze.',
  },
  aktywuj: {
    title: 'Aktywuj',
    icon: '⚡',
    desc: 'Tryb głębokiego treningu słowa. Przypominasz sobie znaczenie, mówisz na głos i budujesz własne frazy lub zdania. Tutaj słowo przestaje być tylko znane — zaczynasz czuć, że potrafisz go użyć w prawdziwej rozmowie.',
  },
}

/** Strip trailing number (and surrounding space) from pack name to get base series name */
function getSeriesBase(name: string): string {
  return name.replace(/\s+\d+$/, '').trim()
}

export function PackPreviewPage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const [pack, setPack] = useState<Pack | null>(null)
  const [progress, setProgress] = useState<PackageProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeInfo, setActiveInfo] = useState<'sluchaj' | 'aktywuj' | null>(null)
  const infoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeInfo) return
    function handleClick(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setActiveInfo(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [activeInfo])

  useEffect(() => {
    if (!packageId) return
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/data/packs/${packageId}.json`).then(r => {
        if (!r.ok) throw new Error('Nie znaleziono pakietu')
        return r.json() as Promise<Pack>
      }),
      getPackageProgress(packageId),
    ])
      .then(([data, prog]) => {
        setPack(data)
        setProgress(prog ?? null)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Błąd ładowania')
        setLoading(false)
      })
  }, [packageId])

  // Extract pack number badge: "t1-p07" → "7", "t1-p86" → "86"
  function getPackNumber(id: string): string | null {
    const match = id.match(/p0*(\d+)$/)
    return match ? match[1] : null
  }

  // Series siblings
  const currentMeta = allPacks.find(p => p.id === packageId)
  const seriesBase = currentMeta ? getSeriesBase(currentMeta.name) : null
  const seriesPacks = seriesBase
    ? allPacks.filter(p => getSeriesBase(p.name) === seriesBase && p.id !== packageId)
    : []

  if (loading) {
    return (
      <div className="packpreview__loading">
        <div className="spinner" />
      </div>
    )
  }

  if (error || !pack) {
    return (
      <div className="packpreview__error">
        <p>{error ?? 'Nie znaleziono pakietu'}</p>
        <button onClick={() => navigate('/')}>Wróć do listy</button>
      </div>
    )
  }

  const packNum = packageId ? getPackNumber(packageId) : null

  return (
    <div className="packpreview">
      {/* Header */}
      <header className="packpreview__header">
        <button
          className="packpreview__back"
          onClick={() => navigate('/')}
          aria-label="Wróć do listy"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="packpreview__title-block">
          <h1 className="packpreview__name">{pack.name}</h1>
          <div className="packpreview__meta">
            <span className="packpreview__meta-pill">{pack.category}</span>
            <span className="packpreview__meta-pill">{pack.volume}</span>
            {packNum && (
              <span className="packpreview__meta-pill packpreview__meta-pill--num">#{packNum}</span>
            )}
            {progress?.masteredAt && (
              <span className="packpreview__meta-pill packpreview__meta-pill--mastered" title={`Opanowana: ${formatDate(progress.masteredAt)}`}>
                ★ Opanowana
              </span>
            )}
            {progress?.completedAt && !progress?.masteredAt && (
              <span className="packpreview__meta-pill packpreview__meta-pill--completed" title={`Odsłuchana: ${formatDate(progress.completedAt)}`}>
                ✓ Odsłuchana
              </span>
            )}
          </div>
        </div>
        <div className="packpreview__wordcount">{pack.wordCount} słów</div>
      </header>

      {/* Word list */}
      <main className="packpreview__main">
        <ul className="packpreview__wordlist">
          {pack.words.map(word => (
            <li key={word.id} className="packpreview__wordrow">
              <span className="packpreview__polish">{word.polish}</span>
              <span className="packpreview__sep" aria-hidden="true">–</span>
              <span className="packpreview__english">{word.english}</span>
            </li>
          ))}
        </ul>

        {/* Series navigation */}
        {seriesPacks.length > 0 && (
          <section className="packpreview__series">
            <h2 className="packpreview__series-title">Seria</h2>
            <div className="packpreview__series-pills">
              {/* Current pack pill (highlighted) */}
              <span className="packpreview__series-pill packpreview__series-pill--current">
                {pack.name}
              </span>
              {/* Other packs in series */}
              {seriesPacks.map(sibling => (
                <button
                  key={sibling.id}
                  className="packpreview__series-pill"
                  onClick={() => navigate(`/pakiet/${sibling.id}`)}
                >
                  {sibling.name}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Sticky bottom action bar */}
      <div className="packpreview__actions" ref={infoRef}>
        {activeInfo && (
          <div className="packpreview__mode-info">
            <span className="packpreview__mode-info-icon">{MODE_INFO[activeInfo].icon}</span>
            <div>
              <p className="packpreview__mode-info-title">{MODE_INFO[activeInfo].title}</p>
              <p className="packpreview__mode-info-desc">{MODE_INFO[activeInfo].desc}</p>
            </div>
          </div>
        )}
        <div className="packpreview__btns">
          <div className="packpreview__btn-wrap">
            <button
              className="packpreview__btn packpreview__btn--fiszki"
              onClick={() => navigate(`/pakiet/${packageId}/fiszki-start`)}
            >
              <span>⚡</span> Aktywuj
            </button>
            <button
              className={`packpreview__info-btn${activeInfo === 'aktywuj' ? ' packpreview__info-btn--active' : ''}`}
              onClick={e => { e.stopPropagation(); setActiveInfo(v => v === 'aktywuj' ? null : 'aktywuj') }}
              aria-label="Informacje o trybie Aktywuj"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8" strokeWidth="3" strokeLinecap="round"/><line x1="12" y1="12" x2="12" y2="16"/>
              </svg>
            </button>
          </div>
          <div className="packpreview__btn-wrap">
            <button
              className="packpreview__btn packpreview__btn--autoplay"
              onClick={() => navigate(`/pakiet/${packageId}/start`)}
            >
              <span>🎧</span> Słuchaj
            </button>
            <button
              className={`packpreview__info-btn packpreview__info-btn--light${activeInfo === 'sluchaj' ? ' packpreview__info-btn--active' : ''}`}
              onClick={e => { e.stopPropagation(); setActiveInfo(v => v === 'sluchaj' ? null : 'sluchaj') }}
              aria-label="Informacje o trybie Słuchaj"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8" strokeWidth="3" strokeLinecap="round"/><line x1="12" y1="12" x2="12" y2="16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
