import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.join(__dirname, '../../..')
export const PACK_DIR = path.join(ROOT, 'src/data/packs')
export const AUDIO_OUT_DIR = path.join(ROOT, 'audio-output')

export interface Config {
  packIds?: Set<string>
  wordIds?: Set<string> // when set (via --ids-file), further narrows scope to these exact words within packIds
  level?: number
  limit: number
  concurrency: number
  dryRun: boolean
  force: boolean // regenerate even if already present in the remote blob store
  checkpointPath: string
  blobAuditPath: string | null
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

export function loadConfig(): Config {
  const args = parseArgs(process.argv.slice(2))
  const all = Boolean(args.all)
  const level = args.level !== undefined ? Number(args.level) : undefined
  let packIds: Set<string> | undefined
  let wordIds: Set<string> | undefined
  if (args.packs) packIds = new Set(String(args.packs).split(',').map((s) => s.trim()).filter(Boolean))
  if (args['ids-file']) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(ROOT, String(args['ids-file'])), 'utf-8')) as string[]
    wordIds = new Set(raw)
    // ids-file holds WORD ids; derive the set of PACK ids that contain them
    // (packIds narrows which pack files to open — wordIds then narrows to
    // the exact words within, so a pack that's only partially in scope
    // doesn't pull in its other words).
    const packSet = new Set<string>()
    for (const wid of raw) packSet.add(wid.split('-').slice(0, 2).join('-'))
    packIds = packSet
  }
  const defaultLimit = all || packIds || level !== undefined ? Infinity : 20
  return {
    packIds,
    wordIds,
    level,
    limit: args.limit !== undefined ? Number(args.limit) : defaultLimit,
    concurrency: args.concurrency !== undefined ? Number(args.concurrency) : Number(process.env.ELEVENLABS_CONCURRENCY || 3),
    dryRun: Boolean(args['dry-run']),
    force: Boolean(args.force),
    checkpointPath: path.resolve(ROOT, String(args.checkpoint ?? 'audio-output/_reports/checkpoint.jsonl')),
    blobAuditPath: args['no-blob-skip'] ? null : path.resolve(ROOT, String(args['blob-audit'] ?? 'audio-output/_reports/blob-audit.json')),
  }
}

export function createLimiter(concurrency: number) {
  let running = 0
  const queue: (() => void)[] = []
  function next() { while (running < concurrency && queue.length > 0) { running++; queue.shift()!() } }
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push(() => { fn().then(resolve).catch(reject).finally(() => { running--; next() }) })
      next()
    })
  }
}
