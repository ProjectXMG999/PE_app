import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getAllPackageProgress } from '../../services/db'
import './QuickStartCards.css'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'

const packs = packagesIndex as PackMeta[]

export function QuickStartCards() {
  const navigate = useNavigate()
  const [lastPackId, setLastPackId] = useState<string | null>(null)

  useEffect(() => {
    getAllPackageProgress().then(progress => {
      if (progress.length > 0) {
        const last = progress.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
        setLastPackId(last.packageId)
      }
    })
  }, [])

  const randomPack = packs[Math.floor(Date.now() / 86400000) % packs.length]
  const lastPack = lastPackId ? packs.find(p => p.id === lastPackId) : null

  return (
    <div className="quickstart">
      {lastPack && (
        <button
          className="quickstart__card quickstart__card--continue"
          onClick={() => navigate(`/pakiet/${lastPack.id}/fiszki`)}
        >
          <div className="quickstart__card-top">
            <span className="quickstart__label">KONTYNUUJ</span>
            <span className="quickstart__icon">⚡</span>
          </div>
          <span className="quickstart__title">{lastPack.name}</span>
          <span className="quickstart__sub">{lastPack.wordCount} słów</span>
        </button>
      )}
      <button
        className="quickstart__card quickstart__card--random"
        onClick={() => navigate(`/pakiet/${randomPack.id}/fiszki`)}
      >
        <div className="quickstart__card-top">
          <span className="quickstart__label">LOSUJ</span>
          <span className="quickstart__icon">🎲</span>
        </div>
        <span className="quickstart__title">Losowa paczka</span>
        <span className="quickstart__sub">{packs.length} paczek</span>
      </button>
    </div>
  )
}
