import fs from 'fs'
import path from 'path'
import type { CheckpointRecord } from './types.js'

// Results are appended as JSONL, one record per generated word, as soon as
// each batch resolves. A run that crashes or is interrupted (rate limit,
// Ctrl+C, laptop sleep) loses at most the in-flight batches — everything
// already written is skipped automatically on the next run via
// loadCompletedIds(), so scaling from a 1k-word sample up to 13k is just
// re-running with a bigger --limit / --all.

function readLines(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return []
  return fs.readFileSync(filePath, 'utf-8').split('\n').filter((l) => l.trim().length > 0)
}

export function loadCompletedIds(checkpointPath: string): Set<string> {
  const ids = new Set<string>()
  for (const line of readLines(checkpointPath)) {
    try {
      const rec = JSON.parse(line) as CheckpointRecord
      ids.add(rec.id)
    } catch {
      // Skip a corrupt/partial line (e.g. left by a killed process mid-write).
    }
  }
  return ids
}

export function loadAllRecords(checkpointPath: string): CheckpointRecord[] {
  const records: CheckpointRecord[] = []
  for (const line of readLines(checkpointPath)) {
    try {
      records.push(JSON.parse(line) as CheckpointRecord)
    } catch {
      // Skip a corrupt/partial line.
    }
  }
  return records
}

export function appendRecords(checkpointPath: string, records: CheckpointRecord[]): void {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true })
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n'
  fs.appendFileSync(checkpointPath, lines, 'utf-8')
}
