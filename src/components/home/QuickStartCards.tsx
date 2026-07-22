import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useProgressData } from '../../hooks/useProgressData'
import './QuickStartCards.css'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'

const MODE_INFO = {
  sluchaj: {
    icon: '🎧',
    title: 'Słuchaj',
    desc: 'Tryb audio do osłuchania, powtórki i nauki w tle. Uczysz się słów bez patrzenia w ekran. Idealne w aucie, na spacerze, na siłowni, w poczekalni albo w metrze.',
  },
  aktywuj: {
    icon: '⚡',
    title: 'Trenuj',
    desc: 'Tryb głębokiego treningu słowa. Przypominasz sobie znaczenie, mówisz na głos i budujesz własne frazy lub zdania. Tutaj słowo przestaje być tylko znane — zaczynasz czuć, że potrafisz go użyć w prawdziwej rozmowie.',
  },
}

const INFO_SVG = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="8" strokeWidth="3" strokeLinecap="round"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
  </svg>
)

const WAVEFORM = (
  <span className="quickstart__wave" aria-hidden="true">
    <span /><span /><span /><span /><span />
  </span>
)

const GO_ARROW = (
  <span className="quickstart__go" aria-hidden="true">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  </span>
)

const packs = packagesIndex as PackMeta[]

interface QuickCard {
  pack: PackMeta
  startIndex: number
}

export function QuickStartCards() {
  const navigate = useNavigate()
  const snapshot = useProgressData()
  const [activeInfo, setActiveInfo] = useState<'sluchaj' | 'aktywuj' | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeInfo) return
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setActiveInfo(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [activeInfo])

  let autoplayCard: QuickCard = { pack: packs[0], startIndex: 0 }
  let fiszkiCard: QuickCard = { pack: packs[0], startIndex: 0 }
  let fiszkiKnown = 0

  if (snapshot) {
    const { progressMap, knownMap } = snapshot

    // Left: lowest-indexed pack where currentIndex < wordCount (fallback: first pack)
    for (const pack of packs) {
      const idx = progressMap.get(pack.id)?.currentIndex ?? 0
      if (idx < pack.wordCount) {
        autoplayCard = { pack, startIndex: idx }
        break
      }
    }

    // Right: lowest-indexed pack with any word not 'known' or never started (fallback: first pack)
    for (const pack of packs) {
      const knownCount = knownMap.get(pack.id) ?? 0
      if (knownCount < pack.wordCount) {
        fiszkiCard = { pack, startIndex: 0 }
        fiszkiKnown = knownCount
        break
      }
    }
  }

  if (!snapshot) {
    return (
      <div className="quickstart">
        <div className="quickstart__card quickstart__card--skeleton" />
        <div className="quickstart__card quickstart__card--skeleton" />
      </div>
    )
  }

  const listenPct = Math.round((autoplayCard.startIndex / autoplayCard.pack.wordCount) * 100)
  const trainPct = fiszkiCard.pack.wordCount > 0 ? Math.round((fiszkiKnown / fiszkiCard.pack.wordCount) * 100) : 0

  return (
    <div className="quickstart" ref={wrapRef}>
      <div className="quickstart__wrap">
        <button
          className="quickstart__card quickstart__card--autoplay"
          onClick={() => navigate(`/pakiet/${autoplayCard.pack.id}/start`)}
        >
          <div className="quickstart__card-top">
            <span className="quickstart__icon">🎧</span>
            <span className="quickstart__label-group">
              <span className="quickstart__label-eyebrow">Kontynuuj</span>
              <span className="quickstart__label">Słuchaj</span>
            </span>
          </div>
          <span className="quickstart__title">{autoplayCard.pack.name}</span>
          <div className="quickstart__bottom">
            {WAVEFORM}
            <span className="quickstart__bar">
              <span style={{ width: `${listenPct}%` }} />
            </span>
            {GO_ARROW}
          </div>
        </button>
        <button
          className={`quickstart__info-btn${activeInfo === 'sluchaj' ? ' quickstart__info-btn--active' : ''}`}
          onClick={e => { e.stopPropagation(); setActiveInfo(v => v === 'sluchaj' ? null : 'sluchaj') }}
          aria-label="Informacje o trybie Słuchaj"
        >
          {INFO_SVG}
        </button>
      </div>

      <div className="quickstart__wrap">
        <button
          className="quickstart__card quickstart__card--fiszki"
          onClick={() => navigate(`/pakiet/${fiszkiCard.pack.id}/fiszki-start`)}
        >
          <div className="quickstart__card-top">
            <span className="quickstart__icon">⚡</span>
            <span className="quickstart__label-group">
              <span className="quickstart__label-eyebrow">Kontynuuj</span>
              <span className="quickstart__label">Trening</span>
            </span>
          </div>
          <span className="quickstart__title">{fiszkiCard.pack.name}</span>
          <div className="quickstart__bottom">
            {WAVEFORM}
            <span className="quickstart__bar">
              <span style={{ width: `${trainPct}%` }} />
            </span>
            {GO_ARROW}
          </div>
        </button>
        <button
          className={`quickstart__info-btn${activeInfo === 'aktywuj' ? ' quickstart__info-btn--active' : ''}`}
          onClick={e => { e.stopPropagation(); setActiveInfo(v => v === 'aktywuj' ? null : 'aktywuj') }}
          aria-label="Informacje o trybie Trenuj"
        >
          {INFO_SVG}
        </button>
      </div>

      {activeInfo && (
        <div className="quickstart__mode-info">
          <span className="quickstart__mode-info-icon">{MODE_INFO[activeInfo].icon}</span>
          <div>
            <p className="quickstart__mode-info-title">{MODE_INFO[activeInfo].title}</p>
            <p className="quickstart__mode-info-desc">{MODE_INFO[activeInfo].desc}</p>
          </div>
        </div>
      )}
    </div>
  )
}
