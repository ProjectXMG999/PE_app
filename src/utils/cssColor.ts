/**
 * Resolving a CSS colour to actual numbers.
 *
 * The app's palette is written in OKLCH (see styles/tokens.css), which neither
 * canvas maths nor a WebGL uniform can consume. Rather than carry an OKLCH
 * parser — and have it drift the moment the tokens change syntax — this asks
 * the browser: paint one pixel of the colour and read it back. Whatever the
 * notation, the answer is right.
 */

export type Rgb = [number, number, number]

let probe: CanvasRenderingContext2D | null | undefined

function probeCtx(): CanvasRenderingContext2D | null {
  if (probe !== undefined) return probe
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    probe = c.getContext('2d', { willReadFrequently: true })
  } catch {
    probe = null
  }
  return probe
}

/** Resolves any CSS colour to RGB 0-255. Falls back when it can't be parsed. */
export function resolveCssColor(css: string, fallback: Rgb): Rgb {
  const ctx = probeCtx()
  if (!ctx || !css) return fallback
  try {
    // An unparsable colour leaves fillStyle untouched, so seed it with a value
    // the caller would never pass and treat "unchanged" as failure.
    ctx.fillStyle = '#000000'
    ctx.fillStyle = css
    if (ctx.fillStyle === '#000000' && css.trim() !== '#000000') return fallback
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b]
  } catch {
    return fallback
  }
}

/** Reads a custom property off :root and resolves it. */
export function resolveToken(name: string, fallback: Rgb): Rgb {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return resolveCssColor(raw, fallback)
  } catch {
    return fallback
  }
}

/** `var(--accent-blue)` → `--accent-blue`. Null when the string isn't a var(). */
export function tokenNameOf(value: string): string | null {
  return value.match(/var\((--[\w-]+)\)/)?.[1] ?? null
}

export const rgbString = ([r, g, b]: Rgb, alpha = 1): string =>
  alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`

/** RGB scaled to 0-1, the form shaders and WebGL uniforms want. */
export const rgbUnit = ([r, g, b]: Rgb): Rgb => [r / 255, g / 255, b / 255]
