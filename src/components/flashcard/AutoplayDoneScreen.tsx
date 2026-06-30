import { useEffect, useRef } from 'react'
import './AutoplayDoneScreen.css'

interface Props {
  packName: string
  wordCount: number
  autoContinue: boolean
  countdown: number
  totalSecs: number
  nextPackName?: string
  onToggleAutoContinue: () => void
  onRepeat: () => void
  onNext: (() => void) | null
  onMastered: () => void
  onExit: () => void
}

export function AutoplayDoneScreen({
  packName, wordCount, autoContinue, countdown, totalSecs,
  nextPackName, onToggleAutoContinue, onRepeat, onNext, onMastered, onExit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()

    const BAR_COUNT = 28
    const BASE_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
      // Natural waveform shape — taller in the middle
      const pos = i / (BAR_COUNT - 1)
      return 0.2 + 0.8 * Math.sin(pos * Math.PI) * (0.6 + 0.4 * Math.sin(i * 1.3))
    })

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = (ts - startRef.current) / 1000

      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      const barW = (w - (BAR_COUNT - 1) * 3) / BAR_COUNT
      const maxH = h * 0.72

      for (let i = 0; i < BAR_COUNT; i++) {
        const phase = elapsed * 3.5 + i * 0.45
        const wave = Math.sin(phase) * 0.28 + Math.sin(phase * 1.7 + 1) * 0.12
        const bh = Math.max(4, BASE_HEIGHTS[i] * maxH * (0.6 + wave))

        const x = i * (barW + 3)
        const y = (h - bh) / 2

        // Fade in during first 0.6s
        const alpha = Math.min(1, elapsed / 0.6)
        const progress = i / (BAR_COUNT - 1)
        const r = Math.round(139 + (59 - 139) * progress)
        const g = Math.round(92 + (130 - 92) * progress)
        const b = Math.round(246 + (246 - 246) * progress)

        ctx.globalAlpha = alpha * (0.6 + 0.4 * BASE_HEIGHTS[i])
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.beginPath()
        ctx.roundRect(x, y, barW, bh, barW / 2)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const circumference = 2 * Math.PI * 26
  const dashOffset = autoContinue && onNext
    ? circumference * (countdown / totalSecs)
    : circumference

  return (
    <div className="apdone">
      <div className="apdone__content">
        <div className="apdone__wave-wrap">
          <canvas ref={canvasRef} className="apdone__canvas" />
          <div className="apdone__icon">🎧</div>
        </div>

        <div className="apdone__text">
          <h2 className="apdone__title">Paczka odsłuchana!</h2>
          <p className="apdone__sub">{packName} · {wordCount} słów</p>
        </div>

        <div className="apdone__actions">
          <button className="apdone__btn apdone__btn--mastered" onClick={onMastered}>
            <span className="apdone__btn-icon">★</span>
            <span className="apdone__btn-body">
              <span className="apdone__btn-label">Opanowana</span>
              <span className="apdone__btn-sub">Oznacz wszystkie słowa jako znam</span>
            </span>
          </button>

          <div className="apdone__row">
            <button className="apdone__btn apdone__btn--secondary" onClick={onRepeat}>
              <span className="apdone__btn-icon">↺</span>
              <span className="apdone__btn-body">
                <span className="apdone__btn-label">Powtórz</span>
              </span>
            </button>

            {onNext ? (
              <button className="apdone__btn apdone__btn--secondary" onClick={onNext}>
                <span className="apdone__btn-body">
                  <span className="apdone__btn-label">Następna</span>
                  <span className="apdone__btn-sub">{nextPackName}</span>
                </span>
                <span className="apdone__btn-icon">▶</span>
              </button>
            ) : (
              <button className="apdone__btn apdone__btn--secondary" onClick={onExit}>
                <span className="apdone__btn-body">
                  <span className="apdone__btn-label">Lista paczek</span>
                </span>
                <span className="apdone__btn-icon">⌂</span>
              </button>
            )}
          </div>

          <button className="apdone__exit" onClick={onExit}>
            Zakończ i wróć do menu
          </button>

          {onNext && (
            <button
              className={`apdone__autocontinue ${autoContinue ? 'apdone__autocontinue--on' : ''}`}
              onClick={onToggleAutoContinue}
            >
              <span className="apdone__ring">
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.2"/>
                  <circle
                    cx="30" cy="30" r="26" fill="none"
                    stroke="currentColor" strokeWidth="3"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 30 30)"
                    style={{ transition: autoContinue ? 'stroke-dashoffset 1s linear' : 'none' }}
                  />
                  <text x="30" y="35" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">
                    {autoContinue ? countdown : '⏭'}
                  </text>
                </svg>
              </span>
              <span className="apdone__autocontinue-body">
                <span className="apdone__autocontinue-label">
                  {autoContinue ? `Za ${countdown}s → ${nextPackName}` : 'Auto-kontynuacja'}
                </span>
                <span className="apdone__autocontinue-sub">
                  {autoContinue ? 'Kliknij aby zatrzymać' : 'Kliknij aby włączyć'}
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
