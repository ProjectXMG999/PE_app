import { describe, it, expect } from 'vitest'
import { layoutAtlas, hitTest, NEIGHBOURHOOD } from './atlasLayout'
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

const OPTS = { width: 390, maxHeight: 250 }
const ALL = packs(864)

describe('layoutAtlas — the window', () => {
  it('shows a neighbourhood, not the whole catalogue', () => {
    const l = layoutAtlas(ALL, { ...OPTS, center: 400 })
    expect(l.nodes).toHaveLength(NEIGHBOURHOOD)
    expect(l.to - l.from).toBe(NEIGHBOURHOOD)
  })

  it('centres on the requested index', () => {
    const l = layoutAtlas(ALL, { ...OPTS, center: 400 })
    const mid = l.from + (l.to - l.from) / 2
    expect(Math.abs(mid - 400)).toBeLessThanOrEqual(1)
  })

  it('clamps at both ends so the first and last packs stay reachable', () => {
    const start = layoutAtlas(ALL, { ...OPTS, center: 0 })
    expect(start.from).toBe(0)
    expect(start.nodes[0].globalIndex).toBe(0)

    const end = layoutAtlas(ALL, { ...OPTS, center: 863 })
    expect(end.to).toBe(864)
    expect(end.nodes[end.nodes.length - 1].globalIndex).toBe(863)
  })

  it('carries the catalogue index and route number on every node', () => {
    const l = layoutAtlas(ALL, { ...OPTS, center: 200 })
    for (const n of l.nodes) {
      expect(n.globalIndex).toBeGreaterThanOrEqual(l.from)
      expect(n.globalIndex).toBeLessThan(l.to)
      // Fixture ids run p001…p864, so number == index + 1.
      expect(n.num).toBe(n.globalIndex + 1)
    }
    expect(new Set(l.nodes.map(n => n.id)).size).toBe(l.nodes.length)
  })

  it('handles a catalogue smaller than the window', () => {
    const l = layoutAtlas(packs(5), OPTS)
    expect(l.nodes).toHaveLength(5)
    expect(l.from).toBe(0)
  })

  it('handles an empty catalogue without dividing by zero', () => {
    const l = layoutAtlas([], OPTS)
    expect(l.nodes).toHaveLength(0)
    expect(Number.isFinite(l.height)).toBe(true)
  })
})

describe('layoutAtlas — geometry', () => {
  it('keeps nodes on the canvas, bow included', () => {
    const l = layoutAtlas(ALL, { ...OPTS, center: 400 })
    for (const n of l.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(l.padding - 0.001)
      expect(n.x).toBeLessThanOrEqual(l.width - l.padding + 0.001)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeLessThanOrEqual(l.height)
    }
  })

  it('serpentines — odd rows run right-to-left, continuous at the turn', () => {
    const l = layoutAtlas(ALL, { ...OPTS, center: 400 })
    const lastOfRow0 = l.nodes[l.cols - 1]
    const firstOfRow1 = l.nodes[l.cols]
    expect(l.nodes[0].x).toBeLessThan(lastOfRow0.x)
    expect(firstOfRow1.x).toBeCloseTo(lastOfRow0.x, 5)
    expect(firstOfRow1.y).toBeGreaterThan(lastOfRow0.y)
  })

  it('bows each row so it does not read as a ruled line', () => {
    const l = layoutAtlas(ALL, { ...OPTS, center: 400 })
    const ys = l.nodes.slice(0, l.cols).map(n => n.y)
    // Ends high, middle low — a visible arc, not a straight line.
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(5)
    expect(ys[Math.floor(l.cols / 2)]).toBeGreaterThan(ys[0])
  })

  it('makes nodes big enough to read and to hit with a thumb', () => {
    for (const width of [320, 390, 430]) {
      const l = layoutAtlas(ALL, { width, maxHeight: 250, center: 400 })
      expect(l.radius).toBeGreaterThanOrEqual(9)
    }
  })
})

describe('hitTest', () => {
  it('finds the node under its centre, on rows running both ways', () => {
    const l = layoutAtlas(ALL, { ...OPTS, center: 400 })
    for (const i of [0, 1, l.cols - 1, l.cols, l.cols + 3, l.nodes.length - 1]) {
      const n = l.nodes[i]
      expect(hitTest(l, n.x, n.y)?.id).toBe(n.id)
    }
  })

  it('returns null away from any node', () => {
    const l = layoutAtlas(ALL, { ...OPTS, center: 400 })
    expect(hitTest(l, -80, -80)).toBeNull()
    expect(hitTest(l, 5000, 5000)).toBeNull()
  })

  it('respects an explicit tolerance', () => {
    const l = layoutAtlas(ALL, { ...OPTS, center: 400 })
    const n = l.nodes[12]
    expect(hitTest(l, n.x + 4, n.y, 14)?.id).toBe(n.id)
    expect(hitTest(l, n.x + 4, n.y, 2)).toBeNull()
  })
})
