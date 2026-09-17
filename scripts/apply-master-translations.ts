// Put the full Polish translation from the master review sheet
// ("Tłumaczenie PL", e.g. "Móc; umieć; potrafić") into `polish` of every word
// in src/data/packs/*.json — that's what the app displays. The short spoken
// form used for word audio ("Móc") goes to `polishAudio`, so a future audio
// run doesn't read every alternative and note aloud.
//
// The sheet text goes through cleanPolishTranslation() first (typography only:
// "np. W grze" → "np. w grze", "małe I średnie" → "małe i średnie", spacing
// around punctuation). Every word it changed is listed in
// database/database/translation-fixes.csv for review.
//
// English, sentences and audio fields are left untouched.
//
// The app reads packs from Netlify Blobs, not from this folder — run
// `npm run upload-pack-blobs` afterwards to publish.
//
// Usage:
//   npm run gen-sentences:apply-translations -- --dry-run
//   npm run gen-sentences:apply-translations -- --source=database/database/candidates-master-v5.xlsx

import fs from 'fs'
import path from 'path'
import { ROOT } from './sentences/lib/config.js'
import { loadPackFiles } from './sentences/lib/wordSource.js'
import { loadMaster } from './sentences/lib/masterSheet.js'
import { cleanPolishTranslation, normalizePolishForAudio } from './sentences/lib/polishText.js'

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq === -1) out[arg.slice(2)] = true
    else out[arg.slice(2, eq)] = arg.slice(eq + 1)
  }
  return out
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const source = path.resolve(ROOT, String(args.source ?? 'database/database/candidates-master-v5.xlsx'))
  const dryRun = Boolean(args['dry-run'])

  const translations = new Map<string, string>()
  const fixes: { id: string; english: string; sheet: string; cleaned: string }[] = []
  for (const row of loadMaster(source).rows) {
    const id = String(row['wordId'] ?? '').trim()
    const sheet = String(row['Tłumaczenie PL'] ?? '').replace(/\xa0/g, ' ').trim()
    if (!id || !sheet) continue
    const cleaned = cleanPolishTranslation(sheet)
    if (cleaned !== sheet) fixes.push({ id, english: String(row['Słowo ENG'] ?? ''), sheet, cleaned })
    translations.set(id, cleaned)
  }

  const packFiles = loadPackFiles(path.join(ROOT, 'src/data/packs'))
  let words = 0
  let changed = 0
  let filesChanged = 0
  const unmatched: string[] = []
  const examples: string[] = []
  const all: { id: string; polish: string }[] = []

  for (const { file, pack } of packFiles) {
    const before = JSON.stringify(pack)
    for (const word of pack.words as (typeof pack.words[number] & { polishAudio?: string })[]) {
      words++
      const full = translations.get(word.id)
      if (!full) {
        unmatched.push(`${word.id} (${word.english})`)
        word.polish = cleanPolishTranslation(word.polish)
        word.polishAudio = normalizePolishForAudio(word.polish)
        continue
      }
      if (word.polish !== full) {
        changed++
        if (examples.length < 8) examples.push(`${word.id}: "${word.polish}" → "${full}"`)
      }
      word.polish = full
      word.polishAudio = normalizePolishForAudio(full)
      all.push({ id: word.id, polish: full })
    }
    if (JSON.stringify(pack) !== before) {
      filesChanged++
      if (!dryRun) fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n')
    }
  }

  console.log(`${dryRun ? '[dry run] ' : ''}Source: ${path.relative(ROOT, source)}`)
  console.log(`  words in packs: ${words}, translations in sheet: ${translations.size}`)
  console.log(`  polish changed: ${changed}`)
  console.log(`  sheet translations with typography fixes: ${fixes.length}`)
  console.log(`  pack files ${dryRun ? 'that would change' : 'changed'}: ${filesChanged}`)
  for (const e of examples) console.log(`    ${e}`)
  if (unmatched.length > 0) console.warn(`  ⚠ ${unmatched.length} words without a sheet translation (kept as is): ${unmatched.slice(0, 5).join(', ')}`)
  console.log('  longest translations (check they fit on the card):')
  for (const w of all.sort((a, b) => b.polish.length - a.polish.length).slice(0, 10)) {
    console.log(`    ${w.polish.length} ${w.id}: ${w.polish}`)
  }
  if (!dryRun) {
    const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`
    const report = path.join(ROOT, 'database/database/translation-fixes.csv')
    const lines = ['wordId,Słowo ENG,Tłumaczenie PL (arkusz),Tłumaczenie PL (po poprawce)']
    for (const f of fixes) lines.push([f.id, f.english, f.sheet, f.cleaned].map(csvCell).join(','))
    fs.writeFileSync(report, '\ufeff' + lines.join('\n') + '\n')
    console.log(`  fixes report: ${path.relative(ROOT, report)}`)
  }
  if (!dryRun) console.log('Next: npm run upload-pack-blobs (needs NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN) to publish.')
}

main()
