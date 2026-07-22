import { createPortal } from 'react-dom'
import { useRef, useState, useEffect } from 'react'
import './AudioModal.css'

export interface Timing {
  index: number
  startTime: number
  endTime: number
}

interface AudioModalProps {
  title: string
  label: string
  duration: string
  src: string
  paragraphs: string[]
  timings?: Timing[]
  onClose: () => void
}

function fmt(s: number) {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function AudioModal({ title, label, duration, src, paragraphs, timings, onClose }: AudioModalProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const getCurrentIndex = (time: number) => {
    if (!timings) return -1
    const timing = timings.find(t => time >= t.startTime && time < t.endTime)
    return timing ? timing.index : -1
  }

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.play().catch(() => {})

    const updateDuration = () => {
      if (isFinite(a.duration) && a.duration > 0) setTotal(a.duration)
    }

    const onPlay    = () => setPlaying(true)
    const onPause   = () => setPlaying(false)
    const onTime    = () => {
      if (!dragging) {
        setCurrent(a.currentTime)
        setActiveIndex(getCurrentIndex(a.currentTime))
        updateDuration()
      }
    }
    const onBuf     = () => { if (a.buffered.length) setBuffered(a.buffered.end(a.buffered.length - 1)) }
    const onEnded   = () => { setPlaying(false); onClose() }

    a.addEventListener('play',             onPlay)
    a.addEventListener('pause',            onPause)
    a.addEventListener('loadedmetadata',   updateDuration)
    a.addEventListener('durationchange',   updateDuration)
    a.addEventListener('canplay',          updateDuration)
    a.addEventListener('canplaythrough',   updateDuration)
    a.addEventListener('timeupdate',       onTime)
    a.addEventListener('progress',         onBuf)
    a.addEventListener('ended',            onEnded)
    return () => {
      a.removeEventListener('play',           onPlay)
      a.removeEventListener('pause',          onPause)
      a.removeEventListener('loadedmetadata', updateDuration)
      a.removeEventListener('durationchange', updateDuration)
      a.removeEventListener('canplay',        updateDuration)
      a.removeEventListener('canplaythrough', updateDuration)
      a.removeEventListener('timeupdate',     onTime)
      a.removeEventListener('progress',       onBuf)
      a.removeEventListener('ended',          onEnded)
    }
  }, [dragging, onClose])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    playing ? a.pause() : a.play().catch(() => {})
  }

  const seek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const bar = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const ratio = Math.max(0, Math.min(1, (clientX - bar.left) / bar.width))
    const newTime = ratio * total
    setCurrent(newTime)
    if (audioRef.current) audioRef.current.currentTime = newTime
  }

  const skip = (s: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = Math.max(0, Math.min(total, a.currentTime + s))
  }

  const pct = total > 0 ? (current / total) * 100 : 0
  const bufPct = total > 0 ? (buffered / total) * 100 : 0

  return createPortal(
    <div className="am-overlay" onClick={onClose}>
      <div className="am" onClick={e => e.stopPropagation()}>
        <audio ref={audioRef} src={src} preload="auto" />

        {/* Header */}
        <div className="am__header">
          <div className="am__meta">
            <span className="am__label">{label}</span>
            <span className="am__dur-badge">{duration}</span>
          </div>
          <button className="am__close" onClick={onClose} aria-label="Zamknij">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Title */}
        <h2 className="am__title">{title}</h2>

        {/* Player */}
        <div className="am__player">
          {/* Progress bar */}
          <div
            className="am__bar-wrap"
            onMouseDown={e => { setDragging(true); seek(e) }}
            onMouseMove={e => { if (dragging) seek(e) }}
            onMouseUp={e => { seek(e); setDragging(false) }}
            onMouseLeave={() => setDragging(false)}
            onTouchStart={e => { setDragging(true); seek(e) }}
            onTouchMove={e => { if (dragging) seek(e) }}
            onTouchEnd={e => { setDragging(false) }}
          >
            <div className="am__bar-track">
              <div className="am__bar-buffered" style={{ width: `${bufPct}%` }} />
              <div className="am__bar-fill" style={{ width: `${pct}%` }}>
                <div className="am__bar-thumb" />
              </div>
            </div>
          </div>

          {/* Time */}
          <div className="am__time">
            <span>{fmt(current)}</span>
            <span>{total > 0 ? fmt(total) : duration}</span>
          </div>

          {/* Controls */}
          <div className="am__controls">
            <button className="am__skip-btn" onClick={() => skip(-15)} aria-label="Cofnij 15s">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg>
              <span>15</span>
            </button>

            <button className="am__play-btn" onClick={togglePlay} aria-label={playing ? 'Pauza' : 'Odtwórz'}>
              {playing ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              )}
            </button>

            <button className="am__skip-btn am__skip-btn--fwd" onClick={() => skip(15)} aria-label="Przewiń 15s">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-.49-3.5"/>
              </svg>
              <span>15</span>
            </button>
          </div>
        </div>

        {/* Transcript */}
        <div className="am__transcript">
          <div className="am__transcript-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Transkrypcja
          </div>
          <div className="am__transcript-body">
            {paragraphs.map((p, i) => (
              <p
                key={i}
                className={`am__paragraph ${activeIndex === i ? 'am__paragraph--active' : ''}`}
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
