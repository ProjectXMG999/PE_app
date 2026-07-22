import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pack, PackMeta } from '../types/vocabulary'
import { PackageProgress } from '../types/progress'
import { loadProgressSnapshot, ProgressSnapshot } from '../hooks/useProgressData'
import { getAudioUrl } from '../services/audioService'
import {
  LEVEL_COLORS,
  getPackIcon,
  getPackNumber,
  getStatus,
  plWords,
  PackStatus,
} from '../utils/packVisuals'
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
    title: 'Trenuj',
    icon: '⚡',
    desc: 'Tryb głębokiego treningu słowa. Przypominasz sobie znaczenie, mówisz na głos i budujesz własne frazy lub zdania. Tutaj słowo przestaje być tylko znane — zaczynasz czuć, że potrafisz go użyć w prawdziwej rozmowie.',
  },
}

/** Strip trailing number (and surrounding space) from pack name to get base series name */
function getSeriesBase(name: string): string {
  return name.replace(/\s+\d+$/, '').trim()
}

/** Compact status shown on a related-pack row: label + modifier class. */
function relatedStatus(
  status: PackStatus
): { label: string; tone: 'mastered' | 'completed' | 'started' } | null {
  switch (status) {
    case 'mastered':  return { label: 'Opanowana', tone: 'mastered' }
    case 'completed': return { label: 'Odsłuchana', tone: 'completed' }
    case 'started':   return { label: 'W toku', tone: 'started' }
    default:          return null
  }
}

export function PackPreviewPage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const [pack, setPack] = useState<Pack | null>(null)
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeInfo, setActiveInfo] = useState<'sluchaj' | 'aktywuj' | null>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Close the mode-info popover on any outside click.
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
    // Reset scroll — navigating between related packs reuses this page, so the
    // container would otherwise keep the previous pack's scroll position.
    scrollRef.current?.scrollTo({ top: 0 })
    Promise.all([
      fetch(`/data/packs/${packageId}.json`).then(r => {
        if (!r.ok) throw new Error('Nie znaleziono pakietu')
        return r.json() as Promise<Pack>
      }),
      loadProgressSnapshot(),
    ])
      .then(([data, snap]) => {
        setPack(data)
        setSnapshot(snap)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Błąd ładowania')
        setLoading(false)
      })
  }, [packageId])

  const currentMeta = allPacks.find(p => p.id === packageId)
  const seriesBase = currentMeta ? getSeriesBase(currentMeta.name) : null
  // Related packs: same topic base, ordered by level then pack number so the
  // list reads as an easy → hard progression.
  const relatedPacks = useMemo(() => {
    if (!seriesBase) return []
    return allPacks
      .filter(p => getSeriesBase(p.name) === seriesBase && p.id !== packageId)
      .sort((a, b) => (a.level - b.level) || a.id.localeCompare(b.id))
  }, [seriesBase, packageId])

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

  const progress: PackageProgress | undefined = snapshot?.progressMap.get(pack.id)
  const knownCount = snapshot?.knownMap.get(pack.id) ?? 0
  const status = getStatus(progress)
  const packNum = packageId ? getPackNumber(packageId) : null
  const icon = getPackIcon(pack)
  const levelColor = pack.level ? LEVEL_COLORS[pack.level] : undefined

  // Progress ring geometry
  const knownPct = pack.wordCount > 0 ? Math.min((knownCount / pack.wordCount) * 100, 100) : 0
  const R = 26
  const C = 2 * Math.PI * R
  const dash = (knownPct / 100) * C

  return (
    <div className="packpreview" ref={scrollRef}>
      {/* Sticky top bar */}
      <header className="packpreview__topbar">
        <button
          className="packpreview__back"
          onClick={() => navigate('/')}
          aria-label="Wróć do listy"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="packpreview__topbar-title">{pack.name}</h1>
        <span className="packpreview__topbar-count">{pack.wordCount} {plWords(pack.wordCount)}</span>
      </header>

      {/* Hero */}
      <section className="packpreview__hero">
        <div
          className="packpreview__hero-icon"
          style={levelColor ? { background: `${levelColor}22`, color: levelColor } : undefined}
        >
          {icon}
        </div>

        <div className="packpreview__hero-body">
          <h2 className="packpreview__hero-name">{pack.name}</h2>
          <p className="packpreview__hero-sub">{pack.category} · {pack.volume}</p>
          <div className="packpreview__hero-pills">
            {pack.level > 0 && (
              <span
                className="packpreview__pill packpreview__pill--level"
                style={levelColor ? { color: levelColor, borderColor: `${levelColor}55` } : undefined}
              >
                Poziom {pack.level}
              </span>
            )}
            {packNum && <span className="packpreview__pill packpreview__pill--num">#{packNum}</span>}
            {status === 'mastered' && progress?.masteredAt && (
              <span
                className="packpreview__pill packpreview__pill--mastered"
                title={`Opanowana: ${formatDate(progress.masteredAt)}`}
              >
                ★ Opanowana
              </span>
            )}
            {status === 'completed' && progress?.completedAt && (
              <span
                className="packpreview__pill packpreview__pill--completed"
                title={`Odsłuchana: ${formatDate(progress.completedAt)}`}
              >
                ✓ Odsłuchana
              </span>
            )}
          </div>
        </div>

        {/* Mastery progress ring */}
        <div className="packpreview__ring" role="img" aria-label={`${knownCount} z ${pack.wordCount} opanowanych`}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle className="packpreview__ring-track" cx="32" cy="32" r={R} strokeWidth="6" fill="none" />
            <circle
              className="packpreview__ring-fill"
              cx="32" cy="32" r={R} strokeWidth="6" fill="none"
              strokeDasharray={`${dash} ${C}`}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
            />
          </svg>
          <div className="packpreview__ring-label">
            <span className="packpreview__ring-num">{knownCount}</span>
            <span className="packpreview__ring-total">/{pack.wordCount}</span>
          </div>
        </div>
      </section>

      <main className="packpreview__main">
        {/* Word list */}
        <ul className="packpreview__wordlist">
          {pack.words.map(word => (
            <li key={word.id} className="packpreview__wordrow">
              <span className="packpreview__polish">{word.polish}</span>
              <span className="packpreview__sep" aria-hidden="true">–</span>
              <span className="packpreview__english">{word.english}</span>
              <button
                className="packpreview__audio-btn"
                aria-label={`Wymowa: ${word.english}`}
                onClick={e => {
                  e.stopPropagation()
                  const audio = new Audio(getAudioUrl(pack.id, word.audioWord))
                  audio.play().catch(() => {})
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {/* Related packs (same topic across levels) */}
        {relatedPacks.length > 0 && (
          <section className="packpreview__related">
            <h3 className="packpreview__related-title">Powiązane pakiety</h3>
            <p className="packpreview__related-hint">Ten sam temat na innych poziomach</p>
            <div className="packpreview__related-list">
              {/* Current pack — non-interactive "you are here" marker */}
              <div className="packpreview__related-row packpreview__related-row--current">
                <span className="packpreview__related-icon">{icon}</span>
                <div className="packpreview__related-body">
                  <span className="packpreview__related-name">{pack.name}</span>
                  <span className="packpreview__related-meta">
                    Poziom {pack.level} · {pack.volume} · {pack.wordCount} {plWords(pack.wordCount)}
                  </span>
                </div>
                <span className="packpreview__related-here">Tu jesteś</span>
              </div>

              {relatedPacks.map(sibling => {
                const sibProg = snapshot?.progressMap.get(sibling.id)
                const sib = relatedStatus(getStatus(sibProg))
                const sibColor = sibling.level ? LEVEL_COLORS[sibling.level] : undefined
                return (
                  <button
                    key={sibling.id}
                    className="packpreview__related-row"
                    onClick={() => navigate(`/pakiet/${sibling.id}`)}
                  >
                    <span
                      className="packpreview__related-icon"
                      style={sibColor ? { background: `${sibColor}22`, color: sibColor } : undefined}
                    >
                      {getPackIcon(sibling)}
                    </span>
                    <div className="packpreview__related-body">
                      <span className="packpreview__related-name">{sibling.name}</span>
                      <span className="packpreview__related-meta">
                        Poziom {sibling.level} · {sibling.volume} · {sibling.wordCount} {plWords(sibling.wordCount)}
                      </span>
                    </div>
                    {sib && (
                      <span className={`packpreview__related-status packpreview__related-status--${sib.tone}`}>
                        {sib.label}
                      </span>
                    )}
                    <svg
                      className="packpreview__related-chevron"
                      width="18" height="18" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )
              })}
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
              <span>⚡</span> Trenuj
            </button>
            <button
              className={`packpreview__info-btn${activeInfo === 'aktywuj' ? ' packpreview__info-btn--active' : ''}`}
              onClick={e => { e.stopPropagation(); setActiveInfo(v => v === 'aktywuj' ? null : 'aktywuj') }}
              aria-label="Informacje o trybie Trenuj"
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
