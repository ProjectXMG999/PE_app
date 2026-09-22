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

/* ── The launch curtain ────────────────────────────────────────────────────
   Emitted straight into index.html, between markers, because it has to paint
   before the bundle exists — the same reason the theme script in there is
   inline. Generated rather than hand-written so the letter that draws itself
   at launch is the same letter as the favicon: edit the geometry above and
   re-run, never edit the block in index.html.

   Every colour here is a hex copy of a token (tokens.css has not loaded yet),
   which is why index.html's "keep all three in step" note now says four. */
const SPLASH = {
  /* The letter's ink height, in px. Larger against the logotype than the
     horizontal lockup sets them, because this is the one screen where the mark
     is the subject rather than a companion to the word. */
  markH: 92,
  wordCap: 30,     // cap height of the logotype under it
  bloom: 900,      // the ground's one radial bloom
  markIn: 140, markInAt: 60,
  stem: 400, stemAt: 60,
  bowl: 460, bowlAt: 360,   // overlaps the stem, so the two read as one gesture
  word: 500, wordAt: 760,   // = --pe-enter-duration
  by: 400, byAt: 1030,
  out: 280, outAt: 1340,
  reducedOut: 340,
}
const EXPO = 'cubic-bezier(0.16,1,0.3,1)'   // = --ease-out-expo

/* The two draws do NOT use the house curve, for the same kind of reason
   .pe-arrive doesn't. Expo spends ~85% of its distance in the first quarter of
   its duration, which is right for something arriving and settling and wrong
   for a line being traced: measured frame by frame, the stem was already
   complete 90ms in, so the letter read as appearing rather than as being
   drawn — the animation was there and nobody could have seen it. This one
   accelerates briefly, then travels at a near-constant rate the eye can follow,
   and eases out only at the end of the stroke. */
const DRAW = 'cubic-bezier(0.55,0.1,0.3,1)'
const SYS = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"

const wordH = n(SPLASH.wordCap / (capHeight / (ink.y2 - ink.y1)))
const wordW = n((wordH * (ink.x2 - ink.x1)) / (ink.y2 - ink.y1))
const markW = n((SPLASH.markH * MARK.w) / MARK.h)

/* pathLength="1" so the dash maths below is 0–1 and no arc length is hard-coded.
   The stem runs from its cap line down, so a NEGATIVE offset is what grows it
   upward from the foot — the same direction as the glyph's gradient. */
function splashMark() {
  const [x1, y1] = pt(360 - cross)
  const [x2, y2] = pt(cross)
  const common = `stroke="url(#pe-sg)" stroke-width="${G.weight}" stroke-linecap="round" fill="none" pathLength="1"`
  return `<svg class="pe-splash__mark" viewBox="0 0 ${n(MARK.w)} ${n(MARK.h)}" aria-hidden="true">`
    + `<defs>${glyphGrad('pe-sg')}</defs>`
    + `<g transform="translate(${n(-MARK.x1)} ${n(-MARK.y1)})">`
    + `<path class="pe-splash__stem" d="M${stemAxis} ${G.top + cap}V${G.bot - cap}" ${common}/>`
    + `<path class="pe-splash__bowl" d="M${n(x1)} ${n(y1)}A${G.bowlR} ${G.bowlR} 0 1 1 ${n(x2)} ${n(y2)}" ${common}/>`
    + `</g></svg>`
}

const splashCss = `
/* The mark draws itself with stroke-dashoffset, which is a paint-level
   animation rather than a compositor one — the app's usual transform-only rule
   cannot express a line being drawn. It is two short paths on an otherwise
   empty screen, and it is the only one here that is not transform/opacity. */
#pe-splash{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;
background:#010102;animation:pe-splash-out ${SPLASH.out}ms ${EXPO} ${SPLASH.outAt}ms forwards}
#pe-splash::before{content:'';position:absolute;inset:0;
background:radial-gradient(120% 70% at 50% 42%,rgba(168,141,255,.22),transparent 70%);
animation:pe-splash-bloom ${SPLASH.bloom}ms ${EXPO} both}
.pe-splash__lock{position:relative;display:flex;flex-direction:column;align-items:center;
animation:pe-splash-lift ${SPLASH.out}ms ${EXPO} ${SPLASH.outAt}ms forwards}
.pe-splash__mark{height:${SPLASH.markH}px;width:${markW}px;
animation:pe-splash-fade ${SPLASH.markIn}ms linear ${SPLASH.markInAt}ms both}
.pe-splash__stem,.pe-splash__bowl{stroke-dasharray:1}
.pe-splash__stem{animation:pe-splash-up ${SPLASH.stem}ms ${DRAW} ${SPLASH.stemAt}ms both}
.pe-splash__bowl{animation:pe-splash-draw ${SPLASH.bowl}ms ${DRAW} ${SPLASH.bowlAt}ms both}
.pe-splash__word{height:${wordH}px;width:${wordW}px;margin-top:${n(SPLASH.markH * 0.3)}px;
color:#f5f5f8;fill:currentColor;animation:pe-splash-rise ${SPLASH.word}ms ${EXPO} ${SPLASH.wordAt}ms both}
.pe-splash__by{margin-top:${n(SPLASH.markH * 0.16)}px;font:700 11px/1 ${SYS};
letter-spacing:.14em;text-transform:uppercase;color:#94949f;
animation:pe-splash-rise-sm ${SPLASH.by}ms ${EXPO} ${SPLASH.byAt}ms both}
@keyframes pe-splash-bloom{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@keyframes pe-splash-fade{from{opacity:0}to{opacity:1}}
@keyframes pe-splash-up{from{stroke-dashoffset:-1}to{stroke-dashoffset:0}}
@keyframes pe-splash-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes pe-splash-rise{from{opacity:0;transform:translate3d(0,10px,0)}to{opacity:1;transform:none}}
@keyframes pe-splash-rise-sm{from{opacity:0;transform:translate3d(0,6px,0)}to{opacity:1;transform:none}}
@keyframes pe-splash-lift{to{transform:translate3d(0,-10px,0)}}
/* Ends inert, so a bundle that never arrives cannot leave the curtain down. */
@keyframes pe-splash-out{to{opacity:0;visibility:hidden;pointer-events:none}}
/* Tap-to-skip runs DIFFERENTLY-NAMED copies rather than retiming the two above.
   Re-timing them looked instant: an animation still inside its 1340ms delay has
   already elapsed more than a 220ms duration, so shortening it in place jumps
   straight to the end frame and fires animationend the same tick. A new name is
   a new animation, and it starts from zero. */
@keyframes pe-splash-out-fast{to{opacity:0;visibility:hidden;pointer-events:none}}
@keyframes pe-splash-lift-fast{to{transform:translate3d(0,-10px,0)}}
#pe-splash.pe-splash--skip{animation:pe-splash-out-fast 220ms ${EXPO} both}
.pe-splash--skip .pe-splash__lock{animation:pe-splash-lift-fast 220ms ${EXPO} both}
[data-splash='off'] #pe-splash{display:none}
[data-theme='light'] #pe-splash{background:#f4f5f9}
[data-theme='light'] #pe-splash::before{background:radial-gradient(120% 70% at 50% 42%,rgba(124,58,237,.13),transparent 70%)}
[data-theme='light'] .pe-splash__word{color:#2b2c37}
[data-theme='light'] .pe-splash__by{color:#7d7e89}
/* Governs only the window before the bundle loads; animations.css then caps
   every duration at 0.01ms !important, which finishes the curtain outright.
   Reduced motion therefore means a still lockup and no launch animation. */
@media (prefers-reduced-motion:reduce){
#pe-splash{animation:pe-splash-out 200ms linear ${SPLASH.reducedOut}ms forwards}
#pe-splash::before,.pe-splash__mark,.pe-splash__word,.pe-splash__by{animation:pe-splash-fade 160ms linear both}
.pe-splash__lock{animation:none}
.pe-splash__stem,.pe-splash__bowl{stroke-dasharray:none;animation:none}}`

const splashBlock = `    <style>${splashCss}
    </style>
    <div id="pe-splash" aria-hidden="true"><div class="pe-splash__lock">${splashMark()}`
  + `<svg class="pe-splash__word" viewBox="0 0 ${n(ink.x2 - ink.x1)} ${n(ink.y2 - ink.y1)}" aria-hidden="true">`
  + `<g transform="translate(${n(-ink.x1)} ${n(-ink.y1)})">${setWord()}</g></svg>`
  + `<span class="pe-splash__by">by Project English</span></div></div>`

const HTML = path.join(ROOT, 'index.html')
const START = '    <!-- PE:SPLASH:START (generated by scripts/generate-brand.mjs — do not edit by hand) -->'
const END = '    <!-- PE:SPLASH:END -->'
const html = fs.readFileSync(HTML, 'utf8')
const from = html.indexOf(START)
const to = html.indexOf(END)
if (from === -1 || to === -1) {
  throw new Error(`index.html is missing the PE:SPLASH markers — cannot place the launch curtain.`)
}
fs.writeFileSync(HTML,
  html.slice(0, from) + START + '\n' + splashBlock + '\n' + html.slice(to))
console.log('index.html  (launch curtain)')

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
