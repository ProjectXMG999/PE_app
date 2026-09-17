// Resolve the owner's spreadsheet ranges ("words 1-3000" etc., in Lp order)
// into explicit word-id lists for generate-sentences.ts (--ids-file) and
// select-best-candidates.ts. Rows with a firm human pick are always left
// out — those decisions are final and never regenerated or re-picked.
//
// Usage: npm run gen-sentences:ranges

import fs from 'fs'
import path from 'path'
import { ROOT } from './sentences/lib/config.js'
import { loadMaster, wordRowsByLp, firmPick, MASTER_BASE_PATH } from './sentences/lib/masterSheet.js'

const OUT_DIR = path.join(ROOT, 'sentence-output')

function undecidedIds(rows: ReturnType<typeof wordRowsByLp>, from: number, to: number): string[] {
  return rows
    .slice(from - 1, to)
    .filter((r) => firmPick(r) === null)
    .map((r) => String(r['wordId']))
}

function main() {
  const { rows } = loadMaster()
  const byLp = wordRowsByLp(rows)
  console.log(`Master: ${path.basename(MASTER_BASE_PATH)} — ${byLp.length} word rows`)

  const lists: Record<string, string[]> = {
    'ids-1-3000-undecided.json': undecidedIds(byLp, 1, 3000),
    'ids-3001-6000-regen.json': undecidedIds(byLp, 3001, 6000),
    'ids-3001-4000-select.json': undecidedIds(byLp, 3001, 4000),
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const [file, ids] of Object.entries(lists)) {
    fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(ids, null, 2) + '\n')
    const packs = new Set(ids.map((id) => id.split('-').slice(0, 2).join('-')))
    console.log(`  ${file}: ${ids.length} words in ${packs.size} packs`)
  }
}

main()
