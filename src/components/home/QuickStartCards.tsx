import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getAllPackageProgress, getPackageWordProgress } from '../../services/db'
import './QuickStartCards.css'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'

const packs = packagesIndex as PackMeta[]

interface QuickCard {
  pack: PackMeta
  startIndex: number
}

export function QuickStartCards() {
  const navigate = useNavigate()
  const [autoplayCard, setAutoplayCard] = useState<QuickCard | null>(null)
  const [fiszkiCard, setFiszkiCard] = useState<QuickCard | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const allProgress = await getAllPackageProgress()
      const progressById = new Map(allProgress.map(p => [p.packageId, p]))

      // Left: lowest-indexed pack where currentIndex < wordCount (fallback: first pack)
      let foundAutoplay: QuickCard = { pack: packs[0], startIndex: 0 }
      for (const pack of packs) {
        const prog = progressById.get(pack.id)
        const idx = prog?.currentIndex ?? 0
        if (idx < pack.wordCount) {
          foundAutoplay = { pack, startIndex: idx }
          break
        }
      }

      // Right: lowest-indexed pack with any word not 'known' or never started (fallback: first pack)
      let foundFiszki: QuickCard = { pack: packs[0], startIndex: 0 }
      for (const pack of packs) {
        const prog = progressById.get(pack.id)
        if (!prog) {
          foundFiszki = { pack, startIndex: 0 }
          break
        }
        const wordProgress = await getPackageWordProgress(pack.id)
        const knownCount = wordProgress.filter(w => w.status === 'known').length
        if (knownCount < pack.wordCount) {
          foundFiszki = { pack, startIndex: 0 }
          break
        }
      }

      if (!cancelled) {
        setAutoplayCard(foundAutoplay)
        setFiszkiCard(foundFiszki)
        setLoaded(true)
      }
    }

    load().catch(() => {
      setAutoplayCard({ pack: packs[0], startIndex: 0 })
      setFiszkiCard({ pack: packs[0], startIndex: 0 })
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  if (!loaded) {
    return (
      <div className="quickstart">
        <div className="quickstart__card quickstart__card--skeleton" />
        <div className="quickstart__card quickstart__card--skeleton" />
      </div>
    )
  }

  return (
    <div className="quickstart">
      <button
        className="quickstart__card quickstart__card--autoplay"
        onClick={() => navigate(`/pakiet/${autoplayCard!.pack.id}/start`)}
      >
        <div className="quickstart__card-top">
          <span className="quickstart__label">SŁUCHAJ</span>
          <span className="quickstart__icon">🎧</span>
        </div>
        <span className="quickstart__title">{autoplayCard!.pack.name}</span>
        <span className="quickstart__sub--main">Kontynuuj kurs</span>
        <span className="quickstart__sub">
          od słowa {autoplayCard!.startIndex + 1} / {autoplayCard!.pack.wordCount}
        </span>
      </button>

      <button
        className="quickstart__card quickstart__card--fiszki"
        onClick={() => navigate(`/pakiet/${fiszkiCard!.pack.id}/fiszki-start`)}
      >
        <div className="quickstart__card-top">
          <span className="quickstart__label">AKTYWUJ</span>
          <span className="quickstart__icon">⚡</span>
        </div>
        <span className="quickstart__title">{fiszkiCard!.pack.name}</span>
        <span className="quickstart__sub--main">Ucz się głęboko</span>
        <span className="quickstart__sub">{fiszkiCard!.pack.wordCount} słów do nauki</span>
      </button>
    </div>
  )
}
