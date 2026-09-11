/**
 * Builds public/og-image.png — the 1200×630 card that shows when the link is
 * shared. Without it, pasting the URL into Facebook (the main channel for this
 * product) produced a blank grey rectangle.
 *
 * It's rendered as a page in the real browser with the real fonts, then
 * screenshotted — same approach as scripts/shots.mjs, so the card is typeset in
 * Plus Jakarta Sans like everything else rather than approximated.
 *
 *   node scripts/og-image.mjs
 *
 * Depends on public/shots/pakiety-granica-mobile@2x.webp, so run shots.mjs first.
 */
import { chromium } from 'playwright-core'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(HERE, '..', 'public')
const FONT_DIR = join(HERE, '..', 'node_modules', '@fontsource', 'plus-jakarta-sans', 'files')

const dataUri = async (path, mime) =>
  `data:${mime};base64,${(await readFile(path)).toString('base64')}`

async function main() {
  const [shot, font800, font500] = await Promise.all([
    dataUri(join(PUBLIC, 'shots', 'pakiety-granica-mobile@2x.webp'), 'image/webp'),
    dataUri(join(FONT_DIR, 'plus-jakarta-sans-latin-ext-800-normal.woff2'), 'font/woff2'),
    dataUri(join(FONT_DIR, 'plus-jakarta-sans-latin-ext-500-normal.woff2'), 'font/woff2'),
  ])

  const html = `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: PJS; font-weight: 800; src: url('${font800}') format('woff2'); }
    @font-face { font-family: PJS; font-weight: 500; src: url('${font500}') format('woff2'); }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px; height: 630px; overflow: hidden;
      display: grid; grid-template-columns: 1fr 420px; align-items: center;
      padding: 0 0 0 80px;
      font-family: PJS, sans-serif; color: #f7f6fb;
      background:
        radial-gradient(60% 50% at 20% 10%, oklch(0.30 0.14 292 / 0.55) 0%, transparent 62%),
        radial-gradient(50% 45% at 85% 0%, oklch(0.26 0.12 272 / 0.45) 0%, transparent 66%),
        oklch(0.13 0.028 278);
    }
    .kicker {
      font-weight: 800; font-size: 20px; letter-spacing: 0.13em; text-transform: uppercase;
      color: oklch(0.8 0.13 293); margin-bottom: 28px;
    }
    h1 { font-weight: 800; font-size: 60px; line-height: 1.06; letter-spacing: -0.05em; max-width: 620px; }
    h1 em { font-style: normal; color: oklch(0.8 0.13 293); }
    p { margin-top: 24px; font-weight: 500; font-size: 24px; line-height: 1.45; color: oklch(0.79 0.015 275); max-width: 520px; }
    /* A fixed window onto the screenshot rather than the whole 390x844 screen:
       at this size the full phone would only show the search bar and the volume
       header. object-position pulls the frontier pack -- the one thing worth
       showing -- into the visible band. */
    .phone {
      width: 340px; height: 560px; transform: rotate(-4deg);
      border-radius: 44px; padding: 7px; overflow: hidden;
      background: linear-gradient(170deg, oklch(0.30 0.09 290) 0%, oklch(0.13 0.028 278) 55%);
      border: 1px solid oklch(1 0 0 / 0.18);
      box-shadow: 0 40px 90px oklch(0 0 0 / 0.5);
    }
    .phone img {
      width: 100%; height: 100%; display: block;
      object-fit: cover; object-position: 50% 78%;
      border-radius: 38px;
    }
  </style>
  <div>
    <div class="kicker">Progress</div>
    <h1>10 000 słów.<br>4 poziomy.<br><em>Jedna mapa.</em></h1>
    <p>Zawsze wiesz, czego uczyć się teraz i co zrobić dalej.</p>
  </div>
  <div class="phone"><img src="${shot}" alt=""></div>`

  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(PUBLIC, 'og-image.png') })
  await browser.close()
  console.log('→ public/og-image.png (1200×630)')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
