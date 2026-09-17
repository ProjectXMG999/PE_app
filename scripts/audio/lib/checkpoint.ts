// Resumable JSONL checkpoint, same shape as scripts/sentences/lib's pattern:
// one line per completed clip, safe to append-only, safe to re-read after a
// crash/interruption. Kept separate from that other pipeline's checkpoint —
// same idea, different job, no cross-import.
import fs from 'fs'
import { CheckpointRecord } from './types.js'

export class Checkpoint {
  private records = new Map<string, CheckpointRecord>() // key: wordId|kind
  constructor(private filePath: string) {
    if (fs.existsSync(filePath)) {
      for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
        if (!line.trim()) continue
        try {
          const rec = JSON.parse(line) as CheckpointRecord
          this.records.set(`${rec.wordId}|${rec.kind}`, rec)
        } catch { /* tolerate a corrupt trailing line from an interrupted write */ }
      }
    }
  }

  has(wordId: string, kind: string, textHash: string): boolean {
    const rec = this.records.get(`${wordId}|${kind}`)
    return !!rec && rec.ok && rec.textHash === textHash
  }

  append(rec: CheckpointRecord) {
    this.records.set(`${rec.wordId}|${rec.kind}`, rec)
    fs.appendFileSync(this.filePath, JSON.stringify(rec) + '\n')
  }
}

export function textHash(s: string): string {
  // Cheap, deterministic, no crypto import needed for this use.
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0 }
  return h.toString(36)
}
