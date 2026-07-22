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
  const burstCount = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    // Initial burst — 3 waves
    const burst = (count: number, delay: number) => {
      setTimeout(() => {
        for (let i = 0; i < count; i++) particles.current.push(createParticle(canvas))
      }, delay)
    }
    burst(80, 0)
    burst(60, 400)
    burst(50, 900)
    burst(40, 1600)

    const animate = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.clearRect(0, 0, w, h)

      particles.current = particles.current.filter(p => p.opacity > 0.02)

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
    }
  }, [])

  return (
    <div className="mastery">
      <canvas ref={canvasRef} className="mastery__canvas" />

      <div className="mastery__content">
        <div className="mastery__trophy">🏆</div>

        <div className="mastery__text">
          <h1 className="mastery__title">Opanowane!</h1>
          <p className="mastery__sub">{packName}</p>
          <p className="mastery__count">Wszystkie {wordCount} słów znasz na pamięć</p>
        </div>

        <div className="mastery__stars">
          {[0, 1, 2].map(i => (
            <span key={i} className="mastery__star" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>★</span>
          ))}
        </div>

        <div className="mastery__actions">
          <button className="mastery__btn mastery__btn--repeat" onClick={onRepeat}>
            ↺ Powtórz
          </button>
          {onNext ? (
            <button className="mastery__btn mastery__btn--next" onClick={onNext}>
              {nextPackName} ▶
            </button>
          ) : (
            <button className="mastery__btn mastery__btn--next" onClick={onExit}>
              ⌂ Menu
            </button>
          )}
        </div>

        <button className="mastery__exit" onClick={onExit}>
          Wróć do listy paczek
        </button>
      </div>
    </div>
  )
}
