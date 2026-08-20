export interface LevelGuide {
  cefr: string
  minWords: number
  maxWords: number
}

// pack.level (1-4) -> CEFR label + target sentence length.
// Mapping as specified by the project owner: level 1 spans A1 progressing
// toward A2, level 2 = B1, level 3 = B2, level 4 = C1 with some C2 flavor.
// The style guide only gives explicit word-count ranges for A1-B2; the
// level 4 range below extrapolates the same progression since C1/C2 weren't
// covered in the source document.
export const LEVEL_GUIDES: Record<number, LevelGuide> = {
  1: { cefr: 'A1-A2', minWords: 3, maxWords: 10 },
  2: { cefr: 'B1', minWords: 7, maxWords: 14 },
  3: { cefr: 'B2', minWords: 9, maxWords: 18 },
  4: { cefr: 'C1 (miejscami C2)', minWords: 10, maxWords: 20 },
}

export function levelGuideFor(level: number): LevelGuide {
  return LEVEL_GUIDES[level] ?? LEVEL_GUIDES[2]
}
