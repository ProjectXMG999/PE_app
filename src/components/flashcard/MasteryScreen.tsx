import { useEffect, useRef } from 'react'
import './MasteryScreen.css'

interface Props {
  packName: string
  wordCount: number
  onRepeat: () => void
  onNext: (() => void) | null
  nextPackName?: string
  onExit: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  shape: 'rect' | 'circle' | 'star'
  opacity: number
  decay: number
}

const COLORS = [
  '#8B5CF6', '#A78BFA', '#6D28D9',
  '#10B981', '#34D399',
  '#F59E0B', '#FCD34D',
  '#EC4899', '#F472B6',
  '#3B82F6', '#60A5FA',
  '#ffffff',
]

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function createParticle(canvas: HTMLCanvasElement): Particle {
  const dpr = window.devicePixelRatio || 1
  const shapes: Particle['shape'][] = ['rect', 'rect', 'circle', 'star']
  return {
    x: Math.random() * (canvas.width / dpr),
    y: -10,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 2,
    size: Math.random() * 8 + 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.15,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    opacity: 1,
    decay: Math.random() * 0.008 + 0.004,
  }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
}

export function MasteryScreen({ packName, wordCount, onRepeat, onNext, nextPackName, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const particles = useRef<Particle[]>([])

  useEffect(() => {
    if (prefersReducedMotion()) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const timers: ReturnType<typeof setTimeout>[] = []
    const burst = (count: number, delay: number) => {
      timers.push(setTimeout(() => {
        for (let i = 0; i < count; i++) particles.current.push(createParticle(canvas))
      }, delay))
    }
    burst(80, 0)
    burst(60, 400)
    burst(50, 900)
    burst(40, 1600)

    const animate = () => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.clearRect(0, 0, w, h)

      particles.current = particles.current.filter(p => p.opacity > 0.02 && p.y < h + 20)

      for (const p of particles.current) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.06 // gravity
        p.vx *= 0.99
        p.rotation += p.rotationSpeed
        p.opacity -= p.decay

        ctx.save()
        ctx.globalAlpha = Math.max(0, p.opacity)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        } else if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          drawStar(ctx, 0, 0, p.size / 2)
          ctx.fill()
        }

        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="mastery">
      <canvas ref={canvasRef} className="mastery__canvas" aria-hidden="true" />

      <div className="mastery__content" role="dialog" aria-label="Paczka opanowana">
        <div className="mastery__badge">
          <span className="mastery__ring" aria-hidden="true" />
          <span className="mastery__ring mastery__ring--inner" aria-hidden="true" />
          <span className="mastery__medal">
            <span className="mastery__trophy" aria-hidden="true">🏆</span>
          </span>
          <div className="mastery__stars" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <span key={i} className="mastery__star" style={{ '--i': i } as React.CSSProperties}>★</span>
            ))}
          </div>
        </div>

        <div className="mastery__text">
          <p className="mastery__eyebrow">Paczka opanowana</p>
          <h1 className="mastery__title">Brawo!</h1>
          <p className="mastery__sub">{packName}</p>
        </div>

        <div className="mastery__chip">
          <span className="mastery__chip-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          Wszystkie {wordCount} słów w pamięci
        </div>

        <div className="mastery__actions">
          <button className="mastery__btn mastery__btn--repeat" onClick={onRepeat}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            <span>Od nowa</span>
          </button>
          {onNext ? (
            <button className="mastery__btn mastery__btn--next" onClick={onNext}>
              <span className="mastery__btn-label">{nextPackName ?? 'Następna paczka'}</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          ) : (
            <button className="mastery__btn mastery__btn--next" onClick={onExit}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 10.5 9-7 9 7" />
                <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
              </svg>
              <span>Strona główna</span>
            </button>
          )}
        </div>

        {onNext && (
          <button className="mastery__exit" onClick={onExit}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 10.5 9-7 9 7" />
              <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
            </svg>
            Wróć do strony głównej
          </button>
        )}
      </div>
    </div>
  )
}
