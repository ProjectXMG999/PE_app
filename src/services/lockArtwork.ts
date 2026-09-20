import { LEVEL_COLORS } from '../data/levels'
import { resolveCssColor, resolveToken, rgbString, tokenNameOf, type Rgb } from '../utils/cssColor'

/**
 * The lock-screen cover art for the listening mode.
 *
 * Słuchaj is designed to be used with the screen off — which means that while
 * it runs, the lock screen IS the app's interface, and until now it showed the
 * app icon. This paints the word that is actually playing instead: pull the
 * phone out of your pocket mid-session and it tells you where you are.
 *
 * Handed to MediaSession as a blob URL. Android Chrome renders it on the lock
 * screen and in the notification shade; iOS is best-effort (useMediaSession's
 * own doc comment covers why), and the failure mode there is the previous
 * behaviour — no artwork — never a broken session.
 */

/** MediaSession wants a square; 512 is the largest size the spec's examples use. */
const SIZE = 512

interface Palette {
  ground: Rgb
  accent: Rgb
}

function paletteFor(level: number): Palette {
  const token = tokenNameOf(LEVEL_COLORS[level] ?? '')
  const accent = token
    ? resolveToken(token, [140, 120, 240])
    : resolveCssColor(LEVEL_COLORS[level] ?? '', [140, 120, 240])
  // Deliberately NOT --bg-primary: the lock screen has its own dark chrome in
  // both themes, so a card that flipped to white in light mode would look like
  // a bug rather than a preference.
  return { ground: [5, 6, 12], accent }
}

/**
 * Largest font size at which `text` fits `maxWidth`, down to a floor.
 *
 * Needed because the words range from "Be" to "responsibility" and a fixed size
 * either wastes the card or runs off it.
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  weight: number
): number {
  let size = start
  while (size > min) {
    ctx.font = `${weight} ${size}px ${FONT_STACK}`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 4
  }
  ctx.font = `${weight} ${size}px ${FONT_STACK}`
  return size
}

// The system face, same as the app (see --font-heading in tokens.css). Canvas
// can't read a CSS custom property, so the stack is repeated here; it is the
// one place in the codebase that legitimately names faces directly.
const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export interface LockArtworkSpec {
  english: string
  polish: string
  packName: string
  level: number
}

/**
 * Renders the card and returns a blob URL, or null if anything is unavailable.
 * The caller owns the URL and must revoke it — see `releaseArtwork`.
 */
export async function renderLockArtwork(spec: LockArtworkSpec): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const { ground, accent } = paletteFor(spec.level)

    ctx.fillStyle = rgbString(ground)
    ctx.fillRect(0, 0, SIZE, SIZE)

    // A wash of the level's colour, off-centre, so the four levels are
    // recognisable at a glance from across the room.
    const bloom = ctx.createRadialGradient(SIZE * 0.28, SIZE * 0.22, 0, SIZE * 0.28, SIZE * 0.22, SIZE * 0.95)
    bloom.addColorStop(0, rgbString(accent, 0.34))
    bloom.addColorStop(1, rgbString(accent, 0))
    ctx.fillStyle = bloom
    ctx.fillRect(0, 0, SIZE, SIZE)

    const pad = 44
    const inner = SIZE - pad * 2

    // Pack name — the quiet line that says which part of the route this is.
    ctx.fillStyle = rgbString(accent, 0.92)
    ctx.font = `600 22px ${FONT_STACK}`
    ctx.letterSpacing = '3px'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(truncate(ctx, spec.packName.toUpperCase(), inner), pad, pad + 26)
    ctx.letterSpacing = '0px'

    // Both lines are measured before either is drawn, because the gap between
    // them has to come from the POLISH size. Deriving it from the English size
    // looked fine for "Be" at 108px and ran the two lines together for
    // "responsibility", which shrinks to about half that.
    const englishSize = fitFont(ctx, spec.english, inner, 108, 40, 700)
    const englishText = truncate(ctx, spec.english, inner)
    const polishSize = fitFont(ctx, spec.polish, inner, 46, 24, 400)
    const polishText = truncate(ctx, spec.polish, inner)

    // Optically centre the pair rather than pinning the first baseline: a short
    // word and a long one then sit in the same place on the card.
    const blockHeight = englishSize + polishSize * 1.35
    const englishBaseline = (SIZE - blockHeight) / 2 + englishSize * 0.82

    ctx.fillStyle = '#FFFFFF'
    ctx.font = `700 ${englishSize}px ${FONT_STACK}`
    ctx.fillText(englishText, pad, englishBaseline)

    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.font = `400 ${polishSize}px ${FONT_STACK}`
    ctx.fillText(polishText, pad, englishBaseline + polishSize * 1.35)

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

/** Trims with an ellipsis at whatever the CURRENT ctx.font is. */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) {
    out = out.slice(0, -1)
  }
  return out + '…'
}

export function releaseArtwork(url: string | null): void {
  if (url) URL.revokeObjectURL(url)
}
