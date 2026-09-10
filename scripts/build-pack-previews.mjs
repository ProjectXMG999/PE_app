import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Builds public/data/pack-previews.json — three English words per pack.
 *
 * Why a separate file and not the pack index: the index is imported into the
 * main bundle, and this only matters once the pack list is on screen. Loaded
 * lazily, it costs nothing at startup.
 *
 * ── What this deliberately does and does not protect ─────────────────────────
 * This file is PUBLIC. The blur on locked cards is a visual teaser, not access
 * control — anyone can open the JSON. That is an accepted trade: three English
 * headwords carry no translation, no example sentence, no audio and no position
 * within the pack, so the product (the ordering, the pairs, the SRS) stays
 * behind the entitled `pack-content` function. If that trade ever stops being
 * acceptable, previews have to move into that function instead.
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const packsDir = join(root, 'src/data/packs')
const outFile = join(root, 'public/data/pack-previews.json')

const PREVIEW_COUNT = 3

const previews = {}
let packs = 0

for (const file of readdirSync(packsDir).sort()) {
  if (!file.endsWith('.json')) continue
  const pack = JSON.parse(readFileSync(join(packsDir, file), 'utf8'))
  const words = (pack.words ?? [])
    .map(w => w.english)
    .filter(Boolean)
    .slice(0, PREVIEW_COUNT)
  if (words.length > 0) {
    previews[pack.id] = words
    packs++
  }
}

writeFileSync(outFile, JSON.stringify(previews))
const bytes = readFileSync(outFile).length
console.log(`[previews] ${packs} packs → ${outFile} (${(bytes / 1024).toFixed(1)} kB)`)
