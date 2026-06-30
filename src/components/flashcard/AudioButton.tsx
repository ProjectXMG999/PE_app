import { useState } from 'react'
import './AudioButton.css'

interface Props {
  onPlay: () => Promise<void>
  caption?: string
}

export function AudioButton({ onPlay, caption = 'Uruchom przed jazdą — audio leci automatycznie' }: Props) {
  const [playing, setPlaying] = useState(false)

  const handleClick = async () => {
    if (playing) return
    setPlaying(true)
    try {
      await onPlay()
    } catch {
      // audio unavailable — silent
    } finally {
      setPlaying(false)
    }
  }

  return (
    <div className="audiobtn-wrap">
      <button
        className={`audiobtn ${playing ? 'audiobtn--playing' : ''}`}
        onClick={handleClick}
        aria-label="Odtwórz audio"
      >
        {playing ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
        )}
      </button>
      <p className="audiobtn__caption">{caption}</p>
    </div>
  )
}
