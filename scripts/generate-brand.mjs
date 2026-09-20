/**
 * PROGRESS — the brand assets, generated from one set of numbers.
 *
 * Run: npm run generate-brand
 *
 * Writes the logotype, the lockups and every install icon. Geometry lives in
 * `G` below and the logotype's outlines in scripts/brand/wordmark.json, so the
 * favicon, the home-screen icon and the wordmark in the top bar cannot drift
 * apart — change a number here and re-run.
 *
 * THE MARK is a geometric P drawn as one stroke weight: a capped stem and a
 * bowl arc of exactly the same width, meeting on the stem's centre line so the
 * join disappears. The previous mark hung a 3.1-unit bowl off a 4.6-unit stem
 * and let the bowl overshoot the stem's cap line — both read as wrong long
 * before you can name why.
 *
 * THE LOGOTYPE is Plus Jakarta Sans ExtraBold, converted to outlines and
 * tracked -3.5%. Outlines, not a font reference: the wordmark then renders
 * identically everywhere and needs no webfont. Plus Jakarta Sans is SIL OFL,
 * which permits commercial use including logos. Source and the conversion
 * script that produced wordmark.json are noted in scripts/brand/README.md.
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ICONS = path.join(ROOT, 'public/icons')
const BRAND = path.join(ROOT, 'public/brand')

const W = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'brand/wordmark.json'), 'utf8'))

/* ── Geometry, in a 64×64 field ────────────────────────────────────────── */
const G = {
  top: 12, bot: 52,        // cap line and baseline of the letter
  stemX: 21, weight: 9,    // left edge of the stem, and the one stroke weight
  bowlCx: 31, bowlCy: 25.5, bowlR: 9,
  radius: 14.5,            // the tile's corner, ~0.227 of its side (iOS-like)
}
const cap = G.weight / 2

/* What the letter actually inks, as opposed to the 64×64 field it is drawn in.
   The lockup measures from this: spacing a logotype off the artboard instead
   of off the letterform is what leaves a lockup looking blown apart. */
const MARK = {
  x1: G.stemX, x2: G.bowlCx + G.bowlR + cap,
  y1: G.top, y2: G.bot,
}
MARK.w = MARK.x2 - MARK.x1
MARK.h = MARK.y2 - MARK.y1

const n = (v) => Number(v.toFixed(3))
const pt = (deg, r = G.bowlR) => [
  G.bowlCx + r * Math.cos((deg * Math.PI) / 180),
  G.bowlCy + r * Math.sin((deg * Math.PI) / 180),
]

/* The bowl opens and closes exactly where its circle crosses the stem's centre
   line — solved, not eyeballed, so it stays true if the geometry above moves.
   Both ends land inside the stem, so the round caps never show and stem and
   bowl read as one continuous letter. */
const stemAxis = G.stemX + cap
const cross = (Math.acos((stemAxis - G.bowlCx) / G.bowlR) * 180) / Math.PI
function markPaths(stroke) {
  const [x1, y1] = pt(360 - cross)   // upper crossing
  const [x2, y2] = pt(cross)         // lower crossing
  const bowl = `M${n(x1)} ${n(y1)}A${G.bowlR} ${G.bowlR} 0 1 1 ${n(x2)} ${n(y2)}`
  const stem = `M${G.stemX + cap} ${G.top + cap}V${G.bot - cap}`
  const common = `stroke="${stroke}" stroke-width="${G.weight}" stroke-linecap="round" fill="none"`
  return `<path d="${stem}" ${common}/><path d="${bowl}" ${common}/>`
}

/* ── Colour ────────────────────────────────────────────────────────────────
   Three stops, not two. A two-stop ramp flattens out across a 32px tile; the
   mid stop keeps the diagonal reading as light travelling over the shape. The
   hues are the app's own --brand-purple/--accent, resolved to hex because
   these files are also read outside the app (manifest, OG image, print). */
const INK = '#1a1526'
const tileGrad = (id) => `
    <linearGradient id="${id}" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7c3aed"/>
      <stop offset="0.55" stop-color="#6d28d9"/>
      <stop offset="1" stop-color="#4c1d95"/>
    </linearGradient>`

/* The glyph's own ramp, for when the P stands on no tile. It climbs
   bottom-left to top-right; that rise is the only place the "progress" idea
   lives at favicon size, and the only one that survives being 16px wide. */
const glyphGrad = (id) => `
    <linearGradient id="${id}" x1="20" y1="52" x2="44" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7c3aed"/>
      <stop offset="1" stop-color="#a78bfa"/>
    </linearGradient>`

const shineGrad = (id) => `
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="0.62" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>`

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n${body}\n</svg>\n`

/* ── The tile: the mark on its ground (install icon, favicon) ──────────────
   `bleed` grows the ground past the viewBox and squares the corners, for
   maskable icons where the platform crops to its own shape. */
function tile({ bleed = 0, radius = G.radius } = {}) {
  const o = -bleed, s = 64 + bleed * 2
  const r = bleed ? 0 : radius
  return svg('0 0 64 64', `  <defs>${tileGrad('g')}${shineGrad('s')}</defs>
  <rect x="${o}" y="${o}" width="${s}" height="${s}" rx="${r}" fill="url(#g)"/>
  <rect x="${o}" y="${o}" width="${s}" height="${s}" rx="${r}" fill="url(#s)"/>
  ${markPaths('#fff')}`)
}

/** The bare mark, trimmed to its ink — no tile, no dead margin. */
function glyph(fill) {
  const defs = fill ? '' : `  <defs>${glyphGrad('g')}</defs>\n`
  return svg(`0 0 ${n(MARK.w)} ${n(MARK.h)}`,
    `${defs}  <g transform="translate(${n(-MARK.x1)} ${n(-MARK.y1)})">${markPaths(fill ?? 'url(#g)')}</g>`)
}

/** Each letter is drawn at the origin; its place in the word is a transform. */
const setWord = () => W.paths.map((p) =>
  p.x === 0 ? `<path d="${p.d}"/>`
    : `<path transform="translate(${n(p.x)} 0)" d="${p.d}"/>`).join('')

/* ── The lockup ────────────────────────────────────────────────────────────
   The logotype is set to the mark's cap height and shares its baseline, which
   is what makes a lockup look set rather than assembled. */
function lockup({ wordFill, markFill, gapRatio = 0.44 } = {}) {
  const k = MARK.h / W.metrics.capHeight
  const gap = MARK.h * gapRatio          // measured off the letter, not the field
  const { ink } = W.metrics
  // Shift the whole drawing so the mark's own ink starts at (0, 0); the SVG
  // then has no dead margin and drops into a layout at its true size.
  const ox = -MARK.x1, oy = -MARK.y1
  const tx = MARK.w + gap - ink.x1 * k
  const defs = markFill ? '' : `<defs>${glyphGrad('g')}</defs>`
  return svg(`0 0 ${n(MARK.w + gap + (ink.x2 - ink.x1) * k)} ${n(MARK.h + ink.y2 * k)}`,
    `  ${defs}
  <g transform="translate(${n(ox)} ${n(oy)})">${markPaths(markFill ?? 'url(#g)')}</g>
  <g transform="translate(${n(tx)} ${n(MARK.h)}) scale(${n(k)})" fill="${wordFill}">${setWord()}</g>`)
}

/** The logotype alone, trimmed to its ink. */
function wordmark(fill) {
  const { ink } = W.metrics
  return svg(`0 0 ${n(ink.x2 - ink.x1)} ${n(ink.y2 - ink.y1)}`,
    `  <g transform="translate(${n(-ink.x1)} ${n(-ink.y1)})" fill="${fill}">${setWord()}</g>`)
}

/* ── Write ─────────────────────────────────────────────────────────────── */
for (const dir of [ICONS, BRAND]) fs.mkdirSync(dir, { recursive: true })

const writeSvg = (dir, name, content) => {
  fs.writeFileSync(path.join(dir, name), content)
  console.log(`  ${name}`)
  return content
}

console.log('brand/')
const TILE = writeSvg(BRAND, 'progress-icon.svg', tile())
writeSvg(BRAND, 'progress-logo.svg', lockup({ wordFill: '#fff' }))
writeSvg(BRAND, 'progress-logo-light.svg', lockup({ wordFill: INK }))
writeSvg(BRAND, 'progress-logo-mono-white.svg', lockup({ wordFill: '#fff', markFill: '#fff' }))
writeSvg(BRAND, 'progress-logo-mono-black.svg', lockup({ wordFill: '#000', markFill: '#000' }))
writeSvg(BRAND, 'progress-wordmark.svg', wordmark('#fff'))
writeSvg(BRAND, 'progress-wordmark-light.svg', wordmark(INK))
writeSvg(BRAND, 'progress-mark.svg', glyph())
writeSvg(BRAND, 'progress-mark-white.svg', glyph('#fff'))

console.log('icons/')
// The favicon is the tile: at 16px a bare glyph loses to whatever tab colour
// sits behind it, while the tile keeps its own ground.
writeSvg(ICONS, 'progress-mark.svg', TILE)
const MASKABLE = tile({ bleed: 10 })

const png = (source, size, file, density = 512) =>
  sharp(Buffer.from(source), { density })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS, file))
    .then(() => console.log(`  ${file}  ${size}×${size}`))

/* apple-touch-icon is drawn WITHOUT rounded corners and on an opaque ground:
   iOS applies its own mask, and a pre-rounded icon with transparent corners
   gets black wedges outside the squircle. */
const APPLE = tile({ radius: 0 })

await Promise.all([
  png(TILE, 192, 'icon-192.png'),
  png(TILE, 512, 'icon-512.png'),
  png(MASKABLE, 512, 'maskable-512.png'),
  png(APPLE, 180, 'apple-touch-icon.png'),
  png(TILE, 32, 'favicon-32.png'),
])

/* ── The React side ────────────────────────────────────────────────────────
   The app draws its own mark and logotype rather than loading these files, so
   they take the theme and need no network. Emitting the geometry from here is
   what keeps the drawn version and the shipped files the same logo. */
const { ink, capHeight } = W.metrics
const ts = `/* GENERATED by scripts/generate-brand.mjs — do not edit by hand.
 * Run \`npm run generate-brand\` after changing the geometry there.
 *
 * "Progress" set in Plus Jakarta Sans ExtraBold (SIL OFL), converted to
 * outlines and tracked ${(W.metrics.track * 100).toFixed(1)}%. Outlines rather than a webfont: the
 * logotype then renders identically on every device, with nothing to load. */

/** The letter's cap height as a fraction of the ink box — lets a caller size
 *  the logotype by cap height, which is how a lockup is actually specified. */
export const WORDMARK_CAP_RATIO = ${n(capHeight / (ink.y2 - ink.y1))}

/** Ink box of the whole word, origin at its top-left. */
export const WORDMARK_BOX = { w: ${n(ink.x2 - ink.x1)}, h: ${n(ink.y2 - ink.y1)} }

/** Shift that moves the glyph coordinates (baseline at 0) into that box. */
export const WORDMARK_ORIGIN = { x: ${n(-ink.x1)}, y: ${n(-ink.y1)} }

/** One entry per letter: the outline, and where it sits along the line. */
export const WORDMARK_GLYPHS: ReadonlyArray<{ x: number; d: string }> = [
${W.paths.map((p) => `  { x: ${n(p.x)}, d: '${p.d}' },`).join('\n')}
]

/** The mark, in its own 64×64 field. */
export const MARK_GEOMETRY = {
  box: { x: ${MARK.x1}, y: ${MARK.y1}, w: ${n(MARK.w)}, h: ${n(MARK.h)} },
  tileRadius: ${G.radius},
  weight: ${G.weight},
  stem: '${`M${stemAxis} ${G.top + cap}V${G.bot - cap}`}',
  bowl: '${(() => { const [a, b] = pt(360 - cross); const [c, d] = pt(cross)
    return `M${n(a)} ${n(b)}A${G.bowlR} ${G.bowlR} 0 1 1 ${n(c)} ${n(d)}` })()}',
} as const
`
const TS_OUT = path.join(ROOT, 'src/components/brand/wordmark.generated.ts')
fs.writeFileSync(TS_OUT, ts)
console.log('src/components/brand/wordmark.generated.ts')

/* ── Social card ─────────────────────────────────────────────────────────
   1200×630, the size every link unfurler crops toward. The lockup sits at
   40% of the width, centred, on the app's own near-black. */
const OG = { w: 1200, h: 630 }
const lockSvg = lockup({ wordFill: '#fff' })
const lockW = Math.round(OG.w * 0.46)
const lockBuf = await sharp(Buffer.from(lockSvg), { density: 700 })
  .resize({ width: lockW })
  .png()
  .toBuffer()
const lockMeta = await sharp(lockBuf).metadata()

await sharp({
  create: { width: OG.w, height: OG.h, channels: 4, background: '#0b0912' },
})
  .composite([{
    input: lockBuf,
    left: Math.round((OG.w - lockW) / 2),
    top: Math.round((OG.h - lockMeta.height) / 2),
  }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(BRAND, 'og-image.png'))
console.log(`brand/og-image.png  ${OG.w}×${OG.h}`)

console.log('\nDone.')
