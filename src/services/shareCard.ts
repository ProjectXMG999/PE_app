import { plWords } from '../utils/plural'

/**
 * The share-image template.
 *
 * One composition, several payloads: the weekly recap, a milestone, a year in
 * review. Extracted from what was `renderRecapImage`, which had the week's
 * palette, its headline and the 10 000-word denominator baked into the drawing
 * code — fine for one card, an obstacle for the second.
 *
 * Everything is painted straight onto a canvas rather than rasterising the DOM:
 * there's no html-to-canvas dependency in the project, and a share image wants a
 * different composition from the in-app card anyway — bigger numbers, portrait
 * crop, legible as a thumbnail.
 */

const W = 1080
const H = 1350
const PAD = 88

/** Story-ish portrait, the aspect every social surface crops least badly. */
export const SHARE_SIZE = { width: W, height: H }

export interface ShareStat {
  value: string
  label: string
}

export interface ShareRoute {
  knownTotal: number
  total: number
  toNext: number | null
  nextName: string | null
}

export interface ShareCardSpec {
  /** Small letterspaced line at the top — "MÓJ TYDZIEŃ", "KAMIEŃ MILOWY". */
  kicker: string
  /** The one number (or short word) the card exists to show. */
  headline: string
  /** What the headline counts. */
  subline: string
  /** Zero, two or four tiles. Laid out two per row. */
  stats?: ShareStat[]
  /** The route bar. Omitted entirely when absent — the card closes up. */
  route?: ShareRoute | null
  /** Bloom colour behind the headline, as `r, g, b`. Defaults to the app violet. */
  accent?: [number, number, number]
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Pulls in the two faces the share image is drawn with, on the one code path
 * that draws it.
 *
 * Deliberately NOT imported from styles/global.css: that would put both faces
 * in the critical CSS and the service-worker precache for every visitor, to
 * serve a canvas most of them never render.
 *
 * Two steps are required, and the second is the one that is easy to miss:
 * an @font-face rule alone does not make a family available to `ctx.font` —
 * canvas doesn't trigger font loading the way laid-out text does, so the face
 * has to be explicitly loaded first. Without this the image silently rendered
 * in the generic sans fallback, which is what it had been doing.
 */
async function loadShareFonts(): Promise<void> {
  try {
    // Latin + Latin Extended only. The unqualified `700.css` / `400.css`
    // entrypoints pull every subset each family ships — Cyrillic, Greek,
    // Vietnamese, math, symbols — 26 files for a Polish share card. Polish
    // needs both of these and nothing else: ó sits in latin, and ą ć ę ł ń ś ź ż
    // are all in latin-ext.
    await Promise.all([
      import('@fontsource/montserrat/latin-700.css'),
      import('@fontsource/montserrat/latin-ext-700.css'),
      import('@fontsource/roboto/latin-400.css'),
      import('@fontsource/roboto/latin-ext-400.css'),
    ])
    await Promise.all([
      document.fonts.load('700 190px Montserrat'),
      document.fonts.load('400 40px Roboto'),
    ])
  } catch {
    // Falling back to the generic sans is exactly the old behaviour — a missing
    // face must never cost the user their share.
  }
}

/** Shrinks until it fits, so a five-digit headline doesn't run off the card. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min: number): number {
  let size = start
  while (size > min) {
    ctx.font = `700 ${size}px Montserrat, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 6
  }
  ctx.font = `700 ${size}px Montserrat, sans-serif`
  return size
}

export async function renderShareCard(spec: ShareCardSpec): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  await loadShareFonts()

  const [ar, ag, ab] = spec.accent ?? [139, 92, 246]

  ctx.fillStyle = '#010102'
  ctx.fillRect(0, 0, W, H)
  const bloom = ctx.createRadialGradient(W * 0.3, H * 0.28, 0, W * 0.3, H * 0.28, W * 0.75)
  bloom.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0.34)`)
  bloom.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`)
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '700 30px Montserrat, sans-serif'
  ctx.letterSpacing = '5px'
  ctx.fillText(spec.kicker, PAD, 150)
  ctx.letterSpacing = '0px'

  // Headline: the number that means the most.
  ctx.fillStyle = '#FFFFFF'
  const headSize = fitFont(ctx, spec.headline, W - PAD * 2, 190, 90)
  ctx.fillText(spec.headline, PAD, 340)

  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '400 40px Roboto, sans-serif'
  ctx.fillText(spec.subline, PAD, 340 + Math.max(60, headSize * 0.32))

  // A running cursor rather than fixed offsets: a card with no stats closes the
  // gap instead of leaving a hole where the grid would have been.
  let y = 500

  const stats = spec.stats ?? []
  if (stats.length > 0) {
    const cw = (W - PAD * 2 - 32) / 2
    const ch = 190
    stats.forEach(({ value, label }, i) => {
      const x = PAD + (i % 2) * (cw + 32)
      const ty = y + Math.floor(i / 2) * (ch + 32)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      roundRect(ctx, x, ty, cw, ch, 32)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = '#FFFFFF'
      ctx.font = '700 76px Montserrat, sans-serif'
      ctx.fillText(value, x + 40, ty + 108)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '400 30px Roboto, sans-serif'
      ctx.fillText(label, x + 40, ty + 152)
    })
    // +32, not more: this reproduces the spacing the single hard-coded
    // layout had, so the migrated weekly card is pixel-for-pixel what it was.
    y += Math.ceil(stats.length / 2) * (ch + 32) + 32
  }

  const route = spec.route
  if (route) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '400 32px Roboto, sans-serif'
    ctx.fillText(`Na trasie do ${route.total.toLocaleString('pl-PL')} słów`, PAD, y)

    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 84px Montserrat, sans-serif'
    ctx.fillText(
      `${route.knownTotal.toLocaleString('pl-PL')} / ${route.total.toLocaleString('pl-PL')}`,
      PAD,
      y + 96
    )

    const barY = y + 140
    const barW = W - PAD * 2
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    roundRect(ctx, PAD, barY, barW, 16, 8)
    ctx.fill()

    // The four level colours in route order — the same read as the app's own
    // progress bar, so the card and the screen agree at a glance.
    const fillW = Math.max(16, Math.min(1, route.knownTotal / route.total) * barW)
    const grad = ctx.createLinearGradient(PAD, 0, PAD + barW, 0)
    grad.addColorStop(0, '#eab308')
    grad.addColorStop(0.35, '#f97316')
    grad.addColorStop(0.7, '#22c55e')
    grad.addColorStop(1, '#3b82f6')
    ctx.fillStyle = grad
    roundRect(ctx, PAD, barY, fillW, 16, 8)
    ctx.fill()

    if (route.nextName && route.toNext != null) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '400 32px Roboto, sans-serif'
      ctx.fillText(
        `jeszcze ${route.toNext.toLocaleString('pl-PL')} ${plWords(route.toNext)} do ${route.nextName}`,
        PAD,
        barY + 76
      )
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '700 28px Montserrat, sans-serif'
  ctx.letterSpacing = '4px'
  ctx.fillText('PROGRESS', PAD, H - 70)
  ctx.letterSpacing = '0px'

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

export type ShareResult = 'shared' | 'downloaded' | 'failed'

/**
 * Hands the image to the share sheet, falling back to a download.
 *
 * The Web Share file API is absent on desktop Chrome and older Safari, so the
 * fallback isn't an edge case.
 */
export async function shareImage(blob: Blob | null, filename: string, title: string): Promise<ShareResult> {
  if (blob == null) return 'failed'

  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (err) {
      // A user dismissing the share sheet is not a failure worth reporting.
      if ((err as Error).name === 'AbortError') return 'shared'
    }
  }

  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
