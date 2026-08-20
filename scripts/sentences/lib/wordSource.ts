import fs from 'fs'
import path from 'path'
import type { WordTask } from './types.js'

interface PackWord {
  id: string
  english: string
  polish: string
  sentenceEn: string | null
  sentencePl: string | null
}

interface PackFile {
  id: string
  name: string
  category: string
  level: number
  words: PackWord[]
}

export function loadPackFiles(packDir: string, packFilter?: Set<string>): { file: string; pack: PackFile }[] {
  const files = fs
    .readdirSync(packDir)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !packFilter || packFilter.has(f.replace(/\.json$/, '')))
    .sort()

  return files.map((f) => ({
    file: path.join(packDir, f),
    pack: JSON.parse(fs.readFileSync(path.join(packDir, f), 'utf-8')) as PackFile,
  }))
}

// Every word in scope is regenerated from scratch — whatever sentence (if
// any) currently sits in the pack JSON is ignored and will be replaced once
// a candidate is picked and applied. Pass onlyMissing=true to restore the
// narrower "only words without a sentence yet" behavior.
export function collectWordTasks(packFiles: { pack: PackFile }[], onlyMissing = false): WordTask[] {
  const tasks: WordTask[] = []
  for (const { pack } of packFiles) {
    for (const w of pack.words) {
      if (onlyMissing && w.sentenceEn && w.sentencePl) continue
      tasks.push({
        id: w.id,
        english: w.english,
        polish: w.polish,
        category: pack.category,
        level: pack.level,
        packId: pack.id,
        packName: pack.name,
      })
    }
  }
  return tasks
}
