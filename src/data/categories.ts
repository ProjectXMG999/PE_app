import { PackMeta } from '../types/vocabulary'

export interface CategoryStats {
  category: string
  known: number
  total: number
  pct: number
}

/** Known/total word counts grouped by pack category (Czasowniki, Przymiotniki, ...), sorted by total desc. */
export function knownByCategory(allPacks: PackMeta[], knownMap: Map<string, number>): CategoryStats[] {
  const categories = [...new Set(allPacks.map(p => p.category))]
  return categories
    .map(category => {
      const packs = allPacks.filter(p => p.category === category)
      const total = packs.reduce((s, p) => s + p.wordCount, 0)
      const known = packs.reduce((s, p) => s + (knownMap.get(p.id) ?? 0), 0)
      return { category, known, total, pct: total > 0 ? (known / total) * 100 : 0 }
    })
    .sort((a, b) => b.total - a.total)
}
