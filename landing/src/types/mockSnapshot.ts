// Hand-declared local stand-in for the main app's `ProgressSnapshot`
// (src/hooks/useProgressData.ts) — an interface, satisfied structurally.
// Deliberately NOT imported from the main app: that file does live
// IndexedDB work at module scope, which this standalone landing package
// must never pull in. Only the fields actually read by the copied
// services/points.ts, services/achievements.ts, services/weeklyRecap.ts
// are declared here.
import type { PackageProgress, Session, WordProgress, ReviewLedgerEntry } from './progress'

export interface ProgressSnapshot {
  sessions: Session[]
  knownTotal: number
  reviewTotal: number
  retiredCount: number
  packageProgress: PackageProgress[]
  wordProgress: WordProgress[]
  reviewLedger: ReviewLedgerEntry[]
  streak: number
  /** packageId → count of words with status 'known'. */
  knownMap: Map<string, number>
}

// Local stand-ins for the main app's ReadinessResult/ReadinessBreakdown
// (src/hooks/useReadinessScore.ts) — same reasoning, that file also
// contains a live hook, not just types.
export interface ReadinessBreakdown {
  swiezosc: number
  retencja: number
  regularnosc: number
  mowienie: number
  skutecznosc: number
}

export interface ReadinessResult {
  score: number
  breakdown: ReadinessBreakdown
}
