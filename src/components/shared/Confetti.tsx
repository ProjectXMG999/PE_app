import { useEffect, useRef } from 'react'
import './Confetti.css'

/**
 * Hand-rolled canvas particle burst — no library. Extracted from MasteryScreen
 * so the Inteligentny done screen can reuse the same premium celebration
 * instead of growing a second copy.
 */

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

interface Props {
  /** [count, delayMs] pairs — defaults to MasteryScreen's original cadence. */
  bursts?: [number, number][]
  className?: string
}

const DEFAULT_BURSTS: [number, number][] = [[80, 0], [60, 400], [50, 900], [40, 1600]]

export function Confetti({ bursts = DEFAULT_BURSTS, className }: Props) {
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
    for (const [count, delay] of bursts) {
      timers.push(setTimeout(() => {
        for (let i = 0; i < count; i++) particles.current.push(createParticle(canvas))
      }, delay))
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvasRef} className={`confetti-canvas${className ? ` ${className}` : ''}`} aria-hidden="true" />
}
