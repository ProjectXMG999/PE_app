import { CSSProperties, useEffect, useRef } from 'react'
import { useBack } from '../../navigation/navigation'
import './AutoplayDoneScreen.css'

interface Props {
  /** The listening mode's colour, so the finish screen stays in the colour you
   *  just listened in. Everything here reads it through --stage-accent. */
  accent: string
  packName: string
  wordCount: number
  /** Pack words not yet marked 'known' — surfaced as the "practise these" nudge. */
  newCount: number
  autoContinue: boolean
  countdown: number
  totalSecs: number
  nextPackName?: string
  onToggleAutoContinue: () => void
  onRepeat: () => void
  onNext: (() => void) | null
  onPractice: () => void
  onMastered: () => void
  onExit: () => void
}

function newWordsLabel(n: number): string {
  const rem10 = n % 10
  const rem100 = n % 100
  if (n === 1) return '1 nowe słowo'
  if (rem10 >= 2 && rem10 <= 4 && !(rem100 >= 12 && rem100 <= 14)) return `${n} nowe słowa`
  return `${n} nowych słów`
}

export function AutoplayDoneScreen({
  accent, packName, wordCount, newCount, autoContinue, countdown, totalSecs,
  nextPackName, onToggleAutoContinue, onRepeat, onNext, onPractice, onMastered, onExit,
}: Props) {
  const { label, backLabel } = useBack()
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

      // The bars take the listening mode's colour straight off the element —
      // CSS paints `color` from --stage-accent, so the wave follows both the
      // theme and the mode instead of the two hardcoded sRGB stops it used to
      // interpolate (which were the dark theme's violet, in every theme).
      ctx.fillStyle = getComputedStyle(canvas).color

      for (let i = 0; i < BAR_COUNT; i++) {
        const phase = elapsed * 3.5 + i * 0.45
        const wave = Math.sin(phase) * 0.28 + Math.sin(phase * 1.7 + 1) * 0.12
        const bh = Math.max(4, BASE_HEIGHTS[i] * maxH * (0.6 + wave))

        const x = i * (barW + 3)
        const y = (h - bh) / 2

        // Fade in during first 0.6s. Depth across the row comes from alpha
        // rather than a second hue, so there is still one colour on screen.
        const alpha = Math.min(1, elapsed / 0.6)
        const depth = 0.45 + 0.55 * BASE_HEIGHTS[i]

        ctx.globalAlpha = alpha * depth
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
    <div className="apdone" style={{ ['--stage-accent' as string]: accent } as CSSProperties}>
      <div className="apdone__content">
        <div className="apdone__wave-wrap">
          <canvas ref={canvasRef} className="apdone__canvas" />
          <div className="apdone__icon">🎧</div>
        </div>

        <div className="apdone__text">
          <h2 className="apdone__title">Paczka odsłuchana!</h2>
          <p className="apdone__sub">
            {packName} · {wordCount} słów
            {newCount > 0 && <> · <strong>{newWordsLabel(newCount)}</strong> do przećwiczenia</>}
          </p>
        </div>

        <div className="apdone__actions">
          <button className="apdone__btn apdone__btn--mastered u-cta" onClick={onMastered}>
            <span className="apdone__btn-icon">★</span>
            <span className="apdone__btn-body">
              <span className="apdone__btn-label">Opanowana</span>
              <span className="apdone__btn-sub">Oznacz wszystkie słowa jako znam</span>
            </span>
          </button>

          {newCount > 0 && (
            <button className="apdone__btn apdone__btn--practice" onClick={onPractice}>
              <span className="apdone__btn-icon">✍️</span>
              <span className="apdone__btn-body">
                <span className="apdone__btn-label">Przećwicz słabsze</span>
                <span className="apdone__btn-sub">Fiszki z tych, których jeszcze nie znasz</span>
              </span>
            </button>
          )}

          <div className="apdone__row">
            <button className="apdone__btn apdone__btn--secondary" onClick={onRepeat}>
              <span className="apdone__btn-icon apdone__btn-icon--svg" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-4"/>
                </svg>
              </span>
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
                  <span className="apdone__btn-label">{label}</span>
                </span>
                <span className="apdone__btn-icon">⌂</span>
              </button>
            )}
          </div>

          <button className="apdone__exit" onClick={onExit}>
            {backLabel}
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
