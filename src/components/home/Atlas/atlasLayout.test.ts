import { describe, it, expect } from 'vitest'
import { layoutAtlas, hitTest, volumeBands } from './atlasLayout'
import { PackMeta } from '../../../types/vocabulary'

function packs(n: number, volumeEvery = 100): PackMeta[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t1-p${String(i + 1).padStart(3, '0')}`,
    name: `Pack ${i + 1}`,
    volume: `Tom ${Math.floor(i / volumeEvery) + 1}`,
    level: 1,
    category: 'Czasowniki',
    wordCount: 10,
    chapter: 'Rozdział I',
  }))
}

describe('layoutAtlas', () => {
  it('places every pack exactly once', () => {
    const l = layoutAtlas(packs(864), { width: 390, maxHeight: 400 })
    expect(l.nodes).toHaveLength(864)
    expect(new Set(l.nodes.map(n => n.id)).size).toBe(864)
  })

  it('serpentines — odd rows run right-to-left', () => {
    const l = layoutAtlas(packs(200), { width: 390, maxHeight: 400 })
    const firstOfRow0 = l.nodes[0]
    const lastOfRow0 = l.nodes[l.cols - 1]
    const firstOfRow1 = l.nodes[l.cols]
    expect(firstOfRow0.x).toBeLessThan(lastOfRow0.x)
    // Row 1 starts where row 0 ended, so the path is continuous at the turn.
    expect(firstOfRow1.x).toBeCloseTo(lastOfRow0.x, 5)
    expect(firstOfRow1.y).toBeGreaterThan(lastOfRow0.y)
  })

  it('keeps every node on the canvas, bow included', () => {
    const l = layoutAtlas(packs(864), { width: 390, maxHeight: 400 })
    for (const n of l.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(l.padding - 0.001)
      expect(n.x).toBeLessThanOrEqual(l.width - l.padding + 0.001)
      expect(n.y).toBeGreaterThanOrEqual(0)
      // The row bow pushes past `height - padding`; it must never clip.
      expect(n.y).toBeLessThanOrEqual(l.height)
    }
  })

  it('honours the height budget — that is what the columns are solved for', () => {
    for (const maxHeight of [280, 340, 400, 520]) {
      const l = layoutAtlas(packs(864), { width: 390, maxHeight })
      expect(l.height).toBeLessThanOrEqual(maxHeight + 0.001)
    }
  })

  it('bows each row so it does not read as a ruled line', () => {
    const l = layoutAtlas(packs(864), { width: 390, maxHeight: 400 })
    const row0 = l.nodes.slice(0, l.cols)
    const ys = row0.map(n => n.y)
    // Ends sit high, middle sits low — a shallow arc, not a straight line.
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1)
    expect(ys[Math.floor(l.cols / 2)]).toBeGreaterThan(ys[0])
  })

  it('gives a wider canvas more columns and fewer rows', () => {
    const narrow = layoutAtlas(packs(864), { width: 320, maxHeight: 400 })
    const wide = layoutAtlas(packs(864), { width: 430, maxHeight: 400 })
    expect(wide.cols).toBeGreaterThan(narrow.cols)
    expect(wide.rows).toBeLessThan(narrow.rows)
  })

  it('handles an empty pack list without dividing by zero', () => {
    const l = layoutAtlas([], { width: 390, maxHeight: 400 })
    expect(l.nodes).toHaveLength(0)
    expect(Number.isFinite(l.height)).toBe(true)
  })
})

describe('hitTest', () => {
  it('finds the node under its own centre — on both row directions', () => {
    const l = layoutAtlas(packs(864), { width: 390, maxHeight: 400 })
    for (const i of [0, 1, l.cols - 1, l.cols, l.cols + 3, 500, 863]) {
      const n = l.nodes[i]
      expect(hitTest(l, n.x, n.y)?.id).toBe(n.id)
    }
  })

  it('returns null far from any node', () => {
    const l = layoutAtlas(packs(864), { width: 390, maxHeight: 400 })
    expect(hitTest(l, -50, -50)).toBeNull()
    expect(hitTest(l, 5000, 5000)).toBeNull()
  })

  it('respects the tolerance', () => {
    const l = layoutAtlas(packs(864), { width: 390, maxHeight: 400 })
    const n = l.nodes[42]
    expect(hitTest(l, n.x + 3, n.y, 14)?.id).toBe(n.id)
    expect(hitTest(l, n.x + 3, n.y, 2)).toBeNull()
  })
})

describe('volumeBands', () => {
  it('produces one contiguous band per volume', () => {
    const l = layoutAtlas(packs(864, 100), { width: 390, maxHeight: 400 })
    const bands = volumeBands(l)
    expect(bands).toHaveLength(9)
    expect(bands[0].startIndex).toBe(0)
    expect(bands[bands.length - 1].endIndex).toBe(863)
    // Bands tile the range with no gaps and no overlaps.
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].startIndex).toBe(bands[i - 1].endIndex + 1)
    }
  })
})
