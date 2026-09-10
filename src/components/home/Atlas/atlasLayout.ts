import { PackMeta } from '../../../types/vocabulary'
import { routeNumber } from '../../../utils/packRoute'

/**
 * Where the packs sit on the Atlas.
 *
 * ── Why a neighbourhood and not the whole route ──────────────────────────────
 * The first version drew all 864 packs at once. At ~13 px pitch that is a
 * texture: nothing is legible, nothing is tappable, and since most of the
 * catalogue is unvisited it mostly renders emptiness. A real map does not show
 * you the world — it shows your surroundings, and offers a minimap for scale.
 *
 * So this lays out a WINDOW of packs (`NEIGHBOURHOOD` of them, centred on where
 * you are) at a size you can actually read and hit with a thumb, and
 * `Minimap.tsx` carries the full 864 as a slim strip.
 *
 * Pure geometry, no canvas and no DOM, so it stays unit-testable.
 */

export interface AtlasNode {
  id: string
  /** Global route number (1…865) — the pack's position in the curriculum. */
  num: number
  volume: string
  level: number
  x: number
  y: number
  /** Index within the laid-out window. */
  i: number
  /** Index in the full catalogue — what callers map back to a pack. */
  globalIndex: number
}

export interface AtlasLayout {
  nodes: AtlasNode[]
  width: number
  height: number
  cols: number
  rows: number
  stepX: number
  stepY: number
  radius: number
  padding: number
  /** Row index → true when that row runs right-to-left. */
  reversed: (row: number) => boolean
  /** Slice of the catalogue this layout covers. */
  from: number
  to: number
}

/** How many packs the neighbourhood shows. Six rows of eight reads as a route. */
export const NEIGHBOURHOOD = 48
const COLS = 8

export interface LayoutOptions {
  width: number
  maxHeight: number
  padding?: number
  /** Centre the window on this catalogue index. */
  center?: number
  /** How many packs to show; defaults to NEIGHBOURHOOD. */
  count?: number
}

const DEFAULTS = { padding: 26 }
/** How far a row bows from its baseline, as a share of the row pitch. */
export const WAVE = 0.34

/**
 * Lay out a window of the route as a winding path.
 *
 * Nodes come out ~20 px across at phone width — big enough to carry a label and
 * to be tapped, which the all-864 version never was.
 */
export function layoutAtlas(packs: PackMeta[], opts: LayoutOptions): AtlasLayout {
  const padding = opts.padding ?? DEFAULTS.padding
  const count = Math.min(opts.count ?? NEIGHBOURHOOD, packs.length)
  const usable = Math.max(1, opts.width - padding * 2)

  // Window placement: centred on `center`, clamped to the catalogue's ends so
  // the first and last packs are still reachable.
  const half = Math.floor(count / 2)
  const from = Math.max(0, Math.min(Math.max(0, packs.length - count), (opts.center ?? 0) - half))
  const to = Math.min(packs.length, from + count)
  const window = packs.slice(from, to)

  const cols = Math.min(COLS, Math.max(2, window.length))
  const stepX = cols > 1 ? usable / (cols - 1) : 0
  const rows = Math.max(1, Math.ceil(window.length / cols))
  // Rows share the height budget rather than deriving from stepX, so the path
  // fills the canvas at any window size.
  const stepY = rows > 1
    ? Math.max(28, (opts.maxHeight - padding * 2) / (rows - 1))
    : 0

  const nodes: AtlasNode[] = window.map((pack, i) => {
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
      globalIndex: from + i,
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
    // Big enough to read a number on and to hit with a thumb.
    radius: Math.max(9, Math.min(13, stepX * 0.28)),
    padding,
    reversed: (row: number) => row % 2 === 1,
    from,
    to,
  }
}

/** Vertical bow of a row at horizontal position `t` (0→1). */
export function rowOffset(t: number, stepY: number): number {
  return Math.sin(t * Math.PI) * stepY * WAVE
}

/**
 * Nearest node to a point, or null if the tap landed further than `tolerance`.
 *
 * Inverts the serpentine arithmetically instead of scanning: column from `x`,
 * then row from `y` with the bow subtracted (the bow depends only on the
 * column, so this is exact).
 */
export function hitTest(
  layout: AtlasLayout,
  x: number,
  y: number,
  tolerance?: number,
): AtlasNode | null {
  const { padding, stepX, stepY, cols, nodes } = layout
  if (stepX <= 0) return null
  const reach = tolerance ?? layout.radius + 10

  const drawnCol = Math.round((x - padding) / stepX)
  if (drawnCol < 0 || drawnCol >= cols) return null

  const t = cols > 1 ? drawnCol / (cols - 1) : 0
  const row = stepY > 0 ? Math.round((y - padding - rowOffset(t, stepY)) / stepY) : 0
  if (row < 0 || row >= layout.rows) return null

  const col = layout.reversed(row) ? cols - 1 - drawnCol : drawnCol
  const node = nodes[row * cols + col]
  if (!node) return null

  return Math.hypot(node.x - x, node.y - y) <= reach ? node : null
}
