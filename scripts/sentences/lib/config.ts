import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.join(__dirname, '..', '..', '..')

export interface RunConfig {
  model: string
  limit: number
  batchSize: number
  concurrency: number
  packDir: string
  checkpointPath: string
  errorLogPath: string
  dryRun: boolean
  onlyMissing: boolean
  candidate: number
  packFilter?: Set<string>
  pricingOverride?: { inputPerMillion: number; outputPerMillion: number }
}

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

export function loadConfig(argv: string[]): RunConfig {
  const args = parseArgs(argv)

  const inputPrice = process.env.OPENAI_PRICE_INPUT_PER_M
  const outputPrice = process.env.OPENAI_PRICE_OUTPUT_PER_M

  return {
    model: String(args.model ?? process.env.OPENAI_MODEL ?? 'gpt-5.6-terra'),
    limit: args.all ? Infinity : Number(args.limit ?? 1000),
    // Max words per request. Batches are grouped by pack (see lib/batching.ts)
    // so the model sees a full pack's words together — this is a cap, only
    // packs bigger than it get split into sequential chunks (most packs are
    // well under it: median 15, avg ~13, max 34 words).
    batchSize: Number(args['batch-size'] ?? 20),
    concurrency: Number(args.concurrency ?? 6),
    packDir: path.join(ROOT, 'src/data/packs'),
    checkpointPath: path.join(ROOT, 'sentence-output/checkpoint.jsonl'),
    errorLogPath: path.join(ROOT, 'sentence-output/errors.log'),
    dryRun: Boolean(args['dry-run']),
    // Default: regenerate every word in scope, ignoring whatever sentence
    // (if any) is already in the pack — old sentences are discarded, not
    // reused. Pass --only-missing to fall back to the narrower behavior.
    onlyMissing: Boolean(args['only-missing']),
    // Which of the 3 generated candidates apply-generated-sentences.ts
    // writes into the pack JSON. Meant as a quick default/testing path —
    // the real selection happens by reviewing sentence-output/*.xlsx and
    // picking per word.
    candidate: Number(args.candidate ?? 1),
    packFilter: args.packs ? new Set(String(args.packs).split(',')) : undefined,
    pricingOverride:
      inputPrice && outputPrice
        ? { inputPerMillion: Number(inputPrice), outputPerMillion: Number(outputPrice) }
        : undefined,
  }
}
