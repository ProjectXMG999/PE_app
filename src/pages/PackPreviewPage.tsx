import { useEffect, useState } from 'react'
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
      <div className="packpreview__actions">
        <button
          className="packpreview__btn packpreview__btn--fiszki"
          onClick={() => navigate(`/pakiet/${packageId}/fiszki`)}
        >
          <span>🃏</span> Fiszki
        </button>
        <button
          className="packpreview__btn packpreview__btn--autoplay"
          onClick={() => navigate(`/pakiet/${packageId}/start`)}
        >
          <span>🚗</span> Auto-play
        </button>
      </div>
    </div>
  )
}
