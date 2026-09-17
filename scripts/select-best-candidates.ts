// AI selection of the best existing candidate per word, for words the owner
// hasn't decided on. Judges with the owner's Sentence Style Guide
// (lib/selectorPrompt.ts) and with context of earlier decisions: picks
// already made in the same pack (human + AI), the most recent picks, running
// composition stats, and fixed examples of the owner's own choices.
//
// Candidate pool per word (see lib/masterSheet.ts#candidatePool): old
// columns 1-6 from the master sheet plus the new v9 candidates for words
// 1-3000; only the new v9 candidates (columns 1-5) for words 3001+.
//
// Results are appended to sentence-output/ai-picks.jsonl and the run is
// resumable. The master sheet is only read, never written.
//
// Usage:
//   npm run gen-sentences:select -- --calibrate=150        # AI vs owner on already-decided words
//   npm run gen-sentences:select -- --ids-file=sentence-output/ids-1-3000-undecided.json
//   npm run gen-sentences:select -- --ids-file=... --model=gpt-5.6-sol --concurrency=3

import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { ROOT } from './sentences/lib/config.js'
import { loadAllRecords } from './sentences/lib/checkpoint.js'
import { loadPackFiles } from './sentences/lib/wordSource.js'
import { levelGuideFor } from './sentences/lib/levelGuide.js'
import { createLimiter } from './sentences/lib/limiter.js'
import { CostTracker } from './sentences/lib/costTracker.js'
import {
  loadMaster,
  wordRowsByLp,
  firmPick,
  candidatesOf,
  candidatePool,
  type MasterRow,
  type V9Record,
} from './sentences/lib/masterSheet.js'
import {
  buildSelectorSystemPrompt,
  buildSelectorUserPrompt,
  INTENTS,
  TRAITS,
  type SelectorExemplar,
  type SelectorWordInput,
} from './sentences/lib/selectorPrompt.js'

// `reason` is declared before `chosen` on purpose: structured outputs emit
// fields in declaration order, so the model commits to its assessment
// before committing to a number (same mechanism that made PL-first
// generation work in lib/schema.ts).
const PickSchema = z.object({
  wordId: z.string(),
  reason: z.string(),
  chosen: z.number().int(),
  runnerUp: z.number().int(),
  intent: z.enum(INTENTS),
  traits: z.array(z.enum(TRAITS)),
})
const PickBatchSchema = z.object({ picks: z.array(PickSchema) })
type Pick = z.infer<typeof PickSchema>

interface PickRecord extends Pick {
  chosenPl: string
  chosenEn: string
  model: string
  pickedAt: string
}

const CHECKPOINT_V9 = path.join(ROOT, 'sentence-output/checkpoint-v9.jsonl')
const PICKS_PATH = path.join(ROOT, 'sentence-output/ai-picks.jsonl')
const CALIBRATION_PATH = path.join(ROOT, 'sentence-output/ai-calibration.jsonl')
const EXEMPLAR_COUNT = 20
const RECENT_PICKS = 40
const NEARBY_DECISIONS = 8
const MAX_BATCH = 20
const MAX_VALIDATION_RETRIES = 2

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

function packOf(wordId: string): string {
  return wordId.split('-').slice(0, 2).join('-')
}

function readPicks(file: string): PickRecord[] {
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as PickRecord]
      } catch {
        return []
      }
    })
}

// Evenly spread rows from a list, deterministic so exemplars stay identical
// across runs (keeps the long system prompt cacheable).
function spread<T>(items: T[], count: number, offset = 0): T[] {
  if (items.length <= count) return items
  const step = items.length / count
  return Array.from({ length: count }, (_, i) => items[Math.floor(offset + i * step) % items.length])
}

function statsLine(picks: PickRecord[]): string {
  const decided = picks.filter((p) => p.chosen > 0)
  if (decided.length < 20) return `(dopiero ${decided.length} wyborów AI — za mało, żeby liczyć proporcje)`
  const pct = (n: number) => `${Math.round((n / decided.length) * 100)}%`
  const has = (t: string) => decided.filter((p) => p.traits.includes(t as (typeof TRAITS)[number])).length
  return [
    `wyborów: ${decided.length}`,
    `pytania ${pct(decided.filter((p) => p.intent === 'question').length)} (20-30%)`,
    `Emotional Memory ${pct(has('emotional_memory'))} (30-40%)`,
    `Identity Builder ${pct(has('identity_builder'))} (15-25%)`,
    `humor ${pct(has('humor'))} (10-15%)`,
    `krótkie reakcje/komendy ${pct(has('short_reaction'))} (10-20%)`,
    `współczesny świat ${pct(has('modern_world'))} (walor dodatkowy)`,
  ].join('; ')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const model = String(args.model ?? 'gpt-5.6-terra')
  const concurrency = Number(args.concurrency ?? 3)
  const calibrate = args.calibrate ? Number(args.calibrate) : 0
  const dryRun = Boolean(args['dry-run'])

  const { rows } = loadMaster()
  const byLp = wordRowsByLp(rows)
  const positionOf = new Map(byLp.map((r, i) => [String(r['wordId']), i + 1]))
  const rowById = new Map(byLp.map((r) => [String(r['wordId']), r]))
  const rowsByPack = new Map<string, MasterRow[]>()
  for (const r of byLp) {
    const p = packOf(String(r['wordId']))
    if (!rowsByPack.has(p)) rowsByPack.set(p, [])
    rowsByPack.get(p)!.push(r)
  }

  const packMeta = new Map<string, { name: string; category: string; level: number }>()
  for (const { pack } of loadPackFiles(path.join(ROOT, 'src/data/packs'))) {
    packMeta.set(pack.id, { name: pack.name, category: pack.category, level: pack.level })
  }

  const v9 = new Map<string, V9Record>(loadAllRecords(CHECKPOINT_V9).map((r) => [r.id, r]))

  // Owner-taste exemplars: decided words from 1-3000 with a real choice
  // among several candidates.
  const decidedPool = byLp
    .slice(0, 3000)
    .filter((r) => firmPick(r) !== null && candidatesOf(r).length >= 4 && firmPick(r)! <= candidatesOf(r).length)
  const exemplarRows = spread(decidedPool, EXEMPLAR_COUNT)
  const exemplarIds = new Set(exemplarRows.map((r) => String(r['wordId'])))
  const exemplars: SelectorExemplar[] = exemplarRows.map((r) => ({
    english: String(r['Słowo ENG']),
    polish: String(r['Tłumaczenie PL']),
    candidates: candidatesOf(r),
    humanPick: firmPick(r)!,
  }))
  const systemPrompt = buildSelectorSystemPrompt(exemplars)

  // Targets are resolved below; declared early so nearbyDecisions can skip
  // them in calibration (the AI must not see the answers it's graded on).
  let targetSet = new Set<string>()

  // The owner's closest earlier decisions (by Lp) with every candidate he
  // passed over — local taste signal, since his style shifts with level.
  const nearbyDecisions = (startPosition: number): SelectorExemplar[] => {
    const out: SelectorExemplar[] = []
    for (let pos = startPosition - 1; pos >= 1 && out.length < NEARBY_DECISIONS; pos--) {
      const r = byLp[pos - 1]
      const id = String(r['wordId'])
      if (exemplarIds.has(id) || (calibrate > 0 && targetSet.has(id))) continue
      const pick = firmPick(r)
      const cands = candidatesOf(r)
      if (pick === null || cands.length < 3 || !cands.some((c) => c.n === pick)) continue
      out.unshift({ english: String(r['Słowo ENG']), polish: String(r['Tłumaczenie PL']), candidates: cands, humanPick: pick })
    }
    return out
  }

  // Targets.
  let targetIds: string[]
  let outPath: string
  if (calibrate > 0) {
    const calibrationRows = spread(
      decidedPool.filter((r) => !exemplarIds.has(String(r['wordId']))),
      calibrate,
      7
    )
    targetIds = calibrationRows.map((r) => String(r['wordId']))
    outPath = CALIBRATION_PATH
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath)
  } else {
    if (!args['ids-file']) {
      console.error('Pass --ids-file=<json> or --calibrate=<n>.')
      process.exit(1)
    }
    targetIds = JSON.parse(fs.readFileSync(path.resolve(ROOT, String(args['ids-file'])), 'utf-8'))
    outPath = PICKS_PATH
  }
  targetSet = new Set(targetIds)

  const existing = readPicks(outPath)
  const done = new Set(existing.map((p) => p.wordId))
  const allAiPicks: PickRecord[] = calibrate > 0 ? [] : [...existing]
  const aiPickById = new Map(allAiPicks.map((p) => [p.wordId, p]))

  // Build word inputs, in Lp order.
  const inputs: SelectorWordInput[] = []
  let missingV9 = 0
  for (const id of [...targetIds].sort((a, b) => positionOf.get(a)! - positionOf.get(b)!)) {
    if (done.has(id)) continue
    const row = rowById.get(id)
    if (!row) continue
    const position = positionOf.get(id)!
    const pool = calibrate > 0 ? candidatesOf(row) : candidatePool(row, position, v9.get(id))
    if (calibrate === 0 && !v9.has(id)) {
      missingV9++
      continue
    }
    const note = String(row['Wybrane'] ?? '').trim()
    inputs.push({
      wordId: id,
      english: String(row['Słowo ENG']),
      polish: String(row['Tłumaczenie PL']),
      candidates: pool,
      humanNote: calibrate === 0 && note ? note : undefined,
    })
  }
  if (missingV9 > 0) console.warn(`⚠ ${missingV9} words skipped — no v9 candidates yet (run generation first)`)

  // Batches: one pack per request, capped.
  const batches: SelectorWordInput[][] = []
  for (const w of inputs) {
    const last = batches[batches.length - 1]
    if (last && packOf(last[0].wordId) === packOf(w.wordId) && last.length < MAX_BATCH) last.push(w)
    else batches.push([w])
  }

  console.log(
    `${calibrate > 0 ? 'CALIBRATION' : 'SELECTION'}: ${inputs.length} words in ${batches.length} requests (${done.size} already done) — model=${model}, concurrency=${concurrency}, exemplars=${exemplars.length}`
  )
  if (dryRun) {
    const b = batches[0]
    if (b) {
      const pack = packOf(b[0].wordId)
      const meta = packMeta.get(pack)
      console.log(
        buildSelectorUserPrompt(b, {
          packName: meta?.name ?? pack,
          category: meta?.category ?? '',
          level: meta?.level ?? 1,
          cefr: levelGuideFor(meta?.level ?? 1).cefr,
          samePackPicks: [],
          recentPicks: [],
          nearbyDecisions: nearbyDecisions(positionOf.get(b[0].wordId)!),
          stats: statsLine(allAiPicks),
        })
      )
    }
    console.log(`\nSystem prompt: ${systemPrompt.length} chars`)
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('OPENAI_API_KEY env var not set (add it to .env)')
    process.exit(1)
  }
  const client = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 3 })
  const limiter = createLimiter(concurrency)
  const cost = new CostTracker(model)
  let processed = 0
  let failed = 0

  await Promise.all(
    batches.map((batch) =>
      limiter(async () => {
        const pack = packOf(batch[0].wordId)
        const meta = packMeta.get(pack)
        const batchIds = new Set(batch.map((w) => w.wordId))

        // Context is read at call time, so batches that start later see
        // decisions finished by earlier ones.
        const samePackPicks: { english: string; pl: string; en: string; source: 'człowiek' | 'AI' }[] = []
        for (const r of rowsByPack.get(pack) ?? []) {
          const id = String(r['wordId'])
          if (batchIds.has(id) || (calibrate > 0 && targetSet.has(id))) continue
          const human = firmPick(r)
          const humanCand = human !== null ? candidatesOf(r).find((c) => c.n === human) : undefined
          if (humanCand) {
            samePackPicks.push({ english: String(r['Słowo ENG']), pl: humanCand.pl, en: humanCand.en, source: 'człowiek' })
            continue
          }
          const ai = aiPickById.get(id)
          if (ai && ai.chosen > 0) {
            samePackPicks.push({ english: String(r['Słowo ENG']), pl: ai.chosenPl, en: ai.chosenEn, source: 'AI' })
          }
        }

        const recentAi = allAiPicks.filter((p) => p.chosen > 0).slice(-RECENT_PICKS)
        const recentPicks = recentAi.map((p) => ({ pl: p.chosenPl, en: p.chosenEn }))
        if (recentPicks.length < RECENT_PICKS) {
          // Top up with the owner's own picks just before this pack in Lp order.
          const startPos = positionOf.get(batch[0].wordId)!
          for (let pos = startPos - 1; pos >= 1 && recentPicks.length < RECENT_PICKS; pos--) {
            const r = byLp[pos - 1]
            const id = String(r['wordId'])
            if (calibrate > 0 && targetSet.has(id)) continue
            const human = firmPick(r)
            const c = human !== null ? candidatesOf(r).find((x) => x.n === human) : undefined
            if (c) recentPicks.unshift({ pl: c.pl, en: c.en })
          }
        }

        const userPrompt = buildSelectorUserPrompt(batch, {
          packName: meta?.name ?? pack,
          category: meta?.category ?? '',
          level: meta?.level ?? 1,
          cefr: levelGuideFor(meta?.level ?? 1).cefr,
          samePackPicks,
          recentPicks,
          nearbyDecisions: nearbyDecisions(positionOf.get(batch[0].wordId)!),
          stats: statsLine(allAiPicks),
        })

        try {
          let lastError: unknown
          for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
            const completion = await client.beta.chat.completions.parse({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              response_format: zodResponseFormat(PickBatchSchema, 'pick_batch'),
            })
            cost.add(completion.usage)
            const parsed = completion.choices[0]?.message.parsed
            if (!parsed) {
              lastError = new Error('No parsed content returned')
              continue
            }
            const byId = new Map(parsed.picks.map((p) => [p.wordId, p]))
            const problems: string[] = []
            for (const w of batch) {
              const p = byId.get(w.wordId)
              const offered = new Set(w.candidates.map((c) => c.n))
              if (!p) problems.push(`missing ${w.wordId}`)
              else if (p.chosen !== 0 && !offered.has(p.chosen)) problems.push(`${w.wordId} chosen=${p.chosen} not offered`)
              else if (p.runnerUp !== 0 && !offered.has(p.runnerUp)) p.runnerUp = 0
            }
            if (problems.length > 0) {
              lastError = new Error(problems.join('; '))
              continue
            }

            const records: PickRecord[] = batch.map((w) => {
              const p = byId.get(w.wordId)!
              const c = w.candidates.find((x) => x.n === p.chosen)
              return { ...p, chosenPl: c?.pl ?? '', chosenEn: c?.en ?? '', model, pickedAt: new Date().toISOString() }
            })
            fs.mkdirSync(path.dirname(outPath), { recursive: true })
            fs.appendFileSync(outPath, records.map((r) => JSON.stringify(r)).join('\n') + '\n')
            for (const r of records) {
              allAiPicks.push(r)
              aiPickById.set(r.wordId, r)
            }
            processed += batch.length
            console.log(`[${processed}/${inputs.length}] ${pack} — ${cost.summary()}`)
            return
          }
          throw lastError instanceof Error ? lastError : new Error('Selection failed')
        } catch (err) {
          failed++
          console.error(`Batch failed (${pack}): ${err instanceof Error ? err.message : String(err)}`)
        }
      })
    )
  )

  console.log(`\nDone. ${processed}/${inputs.length} words, failed batches: ${failed}. ${cost.summary()}`)
  if (failed > 0) console.log('Re-run the same command to retry — finished words are skipped.')

  if (calibrate > 0) {
    const results = readPicks(CALIBRATION_PATH)
    let exact = 0
    let topTwo = 0
    let none = 0
    const misses: string[] = []
    for (const p of results) {
      const human = firmPick(rowById.get(p.wordId)!)
      if (p.chosen === 0) none++
      if (p.chosen === human) exact++
      if (p.chosen === human || p.runnerUp === human) topTwo++
      else if (misses.length < 12) {
        const row = rowById.get(p.wordId)!
        const hc = candidatesOf(row).find((c) => c.n === human)
        misses.push(`  ${row['Słowo ENG']}: AI ${p.chosen} ("${p.chosenPl}") vs właściciel ${human} ("${hc?.pl ?? '?'}") — ${p.reason}`)
      }
    }
    const pct = (n: number) => `${((n / Math.max(results.length, 1)) * 100).toFixed(1)}%`
    const randomBaseline = results.reduce((sum, p) => sum + 1 / candidatesOf(rowById.get(p.wordId)!).length, 0)
    console.log(`\nKALIBRACJA (${results.length} słów; losowy wybór trafiłby ~${pct(randomBaseline)}):`)
    console.log(`  dokładna zgodność z właścicielem: ${exact} (${pct(exact)})`)
    console.log(`  wybór właściciela w top-2 AI:     ${topTwo} (${pct(topTwo)})`)
    console.log(`  AI odrzuciło wszystkie (0):       ${none} (${pct(none)})`)
    console.log(`Przykłady rozbieżności:\n${misses.join('\n')}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
