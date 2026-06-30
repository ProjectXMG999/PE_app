import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ICONS_DIR = path.join(ROOT, 'public/icons')
const LOGOS_DIR = path.join(ROOT, 'database/logotypes')

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true })
}

// FB miniatura = circular logo, good for icon-192 and icon-512
const fbMiniatura = path.join(LOGOS_DIR, 'FB miniatura kopia 2.png')
// Hexagon = square/hexagon logo, good for maskable
const hexagonLogo = path.join(LOGOS_DIR, 'Hexagon LOGO PE.png')
// White SVG for top bar (copy directly)
const whiteLogoSvg = path.join(LOGOS_DIR, 'ProjectEnglish-logo-revision-white-01.svg')
const darkLogoSvg = path.join(LOGOS_DIR, 'ProjectEnglish-logo-revision-01.svg')
const whiteLogoPng = path.join(LOGOS_DIR, 'ProjectEnglish-logo-revision-white-01.png')

async function run() {
  // icon-192.png: 192x192 from FB miniatura
  await sharp(fbMiniatura)
    .resize(192, 192, { fit: 'contain', background: { r: 13, g: 11, b: 30, alpha: 1 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-192.png'))
  console.log('icon-192.png done')

  // icon-512.png: 512x512 from FB miniatura
  await sharp(fbMiniatura)
    .resize(512, 512, { fit: 'contain', background: { r: 13, g: 11, b: 30, alpha: 1 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512.png'))
  console.log('icon-512.png done')

  // maskable-512.png: 512x512 with 20% safe zone padding, use hexagon logo
  // Maskable icons: the logo must fit in the inner 80% (safe zone)
  const logoSize = Math.floor(512 * 0.6) // 60% of 512 = inner safe area
  const resized = await sharp(hexagonLogo)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 107, g: 43, b: 255, alpha: 0 } })
    .png()
    .toBuffer()

  const padding = Math.floor((512 - logoSize) / 2)
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 107, g: 43, b: 255, alpha: 255 }, // brand purple background
    },
  })
    .composite([{ input: resized, top: padding, left: padding }])
    .png()
    .toFile(path.join(ICONS_DIR, 'maskable-512.png'))
  console.log('maskable-512.png done')

  // apple-touch-icon.png: 180x180, square, with some padding
  const appleLogoSize = Math.floor(180 * 0.65)
  const applePadding = Math.floor((180 - appleLogoSize) / 2)
  const appleResized = await sharp(hexagonLogo)
    .resize(appleLogoSize, appleLogoSize, { fit: 'contain', background: { r: 107, g: 43, b: 255, alpha: 0 } })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 13, g: 11, b: 30, alpha: 255 },
    },
  })
    .composite([{ input: appleResized, top: applePadding, left: applePadding }])
    .png()
    .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'))
  console.log('apple-touch-icon.png done')

  // Copy SVG logos for TopBar
  if (fs.existsSync(whiteLogoSvg)) {
    fs.copyFileSync(whiteLogoSvg, path.join(ICONS_DIR, 'logo-white.svg'))
    console.log('logo-white.svg copied')
  }
  if (fs.existsSync(darkLogoSvg)) {
    fs.copyFileSync(darkLogoSvg, path.join(ICONS_DIR, 'logo-dark.svg'))
    console.log('logo-dark.svg copied')
  }
  if (fs.existsSync(whiteLogoPng)) {
    fs.copyFileSync(whiteLogoPng, path.join(ICONS_DIR, 'logo-white.png'))
    console.log('logo-white.png copied')
  }

  // Also create a screenshot placeholder for PWA manifest
  const screenshotsDir = path.join(ROOT, 'public/screenshots')
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true })
  }

  // Create a simple purple placeholder screenshot
  await sharp({
    create: {
      width: 390,
      height: 844,
      channels: 3,
      background: { r: 13, g: 11, b: 30 },
    },
  })
    .png()
    .toFile(path.join(screenshotsDir, 'home.png'))
  console.log('screenshot placeholder created')

  console.log('\nAll icons generated!')
}

run().catch(console.error)
