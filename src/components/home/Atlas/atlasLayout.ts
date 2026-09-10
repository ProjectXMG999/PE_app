import { PackMeta } from '../../../types/vocabulary'
import { routeNumber } from '../../../utils/packRoute'

/**
 * Where every one of the 864 packs sits on the Atlas.
 *
 * The route is a boustrophedon serpentine: it runs left→right, drops a row, runs
 * right→left, and so on. That shape is chosen over a spiral or a free-form path
 * for three reasons that matter on a phone:
 *
 *  1. reading order is unambiguous — the eye always knows which node is "next";
 *  2. it fills a portrait rectangle at uniform density, so 864 nodes fit in
 *     ~46vh without any node landing closer to another than `minGap`;
 *  3. it is O(1) to invert — hit-testing a tap is arithmetic, not a search
 *     through 864 rects (see `hitTest`).
 *
 * Pure geometry, no canvas and no DOM, so the whole thing is unit-testable.
 */

export interface AtlasNode {
  id: string
  /** Global route number (1…865) — the pack's position in the curriculum. */
  num: number
  volume: string
  level: number
  x: number
  y: number
  /** Index in the ordered pack array. */
  i: number
}

export interface AtlasLayout {
  nodes: AtlasNode[]
  width: number
  height: number
  cols: number
  rows: number
  /** Distance between adjacent node centres along a row. */
  stepX: number
  /** Distance between rows. */
  stepY: number
  radius: number
  padding: number
  /** Row index → true when that row runs right-to-left. */
  reversed: (row: number) => boolean
}

export interface LayoutOptions {
  width: number
  /** The canvas must not exceed this; columns are solved to fit it. */
  maxHeight: number
  /** Horizontal breathing room; also the left/right inset of the route. */
  padding?: number
  radius?: number
}

const DEFAULTS = { padding: 20, radius: 2.6 }
/** Rows sit this much further apart than columns, so lanes stay legible. */
const ROW_RATIO = 1.55
/** How far a row bows from its baseline, as a share of the row pitch. */
export const WAVE = 0.26

/**
 * Lay out packs along the serpentine.
 *
 * Columns are **solved from the height budget**, not from a fixed gap: at 864
 * packs in ~46vh the map is inevitably a texture, and the only question is
 * whether it fits without scrolling. Fewer columns would mean more rows and a
 * canvas taller than the viewport, which is what turned the first attempt into
 * a page-long ledger.
 *
 * Each row also **bows** (see `WAVE` and `rowOffset`). A perfectly straight row
 * of evenly-spaced dots reads as ruled paper; a shallow arc reads as a road.
 * That single change is what makes this a map rather than a grid.
 */
export function layoutAtlas(packs: PackMeta[], opts: LayoutOptions): AtlasLayout {
  const padding = opts.padding ?? DEFAULTS.padding
  const radius = opts.radius ?? DEFAULTS.radius
  const usable = Math.max(1, opts.width - padding * 2)
  const budget = Math.max(80, opts.maxHeight - padding * 2)
  const n = packs.length

  // Smallest column count whose resulting height fits the budget. Monotonic in
  // `cols`, so a linear walk is fine and runs once per resize.
  let cols = 2
  let stepX = usable
  let stepY = usable * ROW_RATIO
  let rows = n
  for (let c = 2; c <= Math.max(2, Math.ceil(usable)); c++) {
    const sx = usable / (c - 1)
    const sy = sx * ROW_RATIO
    const r = Math.max(1, Math.ceil(n / c))
    cols = c; stepX = sx; stepY = sy; rows = r
    if ((r - 1) * sy <= budget) break
  }

  const nodes: AtlasNode[] = packs.map((pack, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    // Odd rows run backwards, so the path is continuous at the turns.
    const drawnCol = row % 2 === 0 ? col : cols - 1 - col
    const t = cols > 1 ? drawnCol / (cols - 1) : 0
    return {
      id: pack.id,
      num: routeNumber(pack.id),
      volume: pack.volume,
      level: pack.level,
      x: padding + drawnCol * stepX,
      y: padding + row * stepY + rowOffset(t, stepY),
      i,
    }
  })

  return {
    nodes,
    width: opts.width,
    height: padding * 2 + Math.max(0, rows - 1) * stepY,
    cols,
    rows,
    stepX,
    stepY,
    radius,
    padding,
    reversed: (row: number) => row % 2 === 1,
  }
}

/** Vertical bow of a row at horizontal position `t` (0→1). */
export function rowOffset(t: number, stepY: number): number {
  return Math.sin(t * Math.PI) * stepY * WAVE
}

/**
 * Nearest node to a point, or null if the tap landed further than `tolerance`.
 *
 * Inverts the serpentine arithmetically instead of scanning: row from `y`, column
 * from `x` (un-reversed on odd rows), then one distance check. Constant time no
 * matter how many packs there are.
 */
export function hitTest(
  layout: AtlasLayout,
  x: number,
  y: number,
  tolerance = 14,
): AtlasNode | null {
  const { padding, stepX, stepY, cols, nodes } = layout
  if (stepX <= 0 || stepY <= 0) return null

  const drawnCol = Math.round((x - padding) / stepX)
  if (drawnCol < 0 || drawnCol >= cols) return null

  // The row bow means y no longer maps to a row by division alone — subtract
  // the bow at this column first, which is exact because the bow depends only
  // on the horizontal position.
  const t = cols > 1 ? drawnCol / (cols - 1) : 0
  const row = Math.round((y - padding - rowOffset(t, stepY)) / stepY)
  if (row < 0 || row >= layout.rows) return null

  const col = layout.reversed(row) ? cols - 1 - drawnCol : drawnCol
  const index = row * cols + col
  const node = nodes[index]
  if (!node) return null

  return Math.hypot(node.x - x, node.y - y) <= tolerance ? node : null
}

/** Contiguous run of rows a volume occupies — used to tint the terrain bands. */
export interface VolumeBand {
  volume: string
  level: number
  startIndex: number
  endIndex: number
}

export function volumeBands(layout: AtlasLayout): VolumeBand[] {
  const bands: VolumeBand[] = []
  for (const node of layout.nodes) {
    const last = bands[bands.length - 1]
    if (last && last.volume === node.volume) last.endIndex = node.i
    else bands.push({ volume: node.volume, level: node.level, startIndex: node.i, endIndex: node.i })
  }
  return bands
}
