import { AtlasLayout, AtlasNode } from './atlasLayout'
import { PackMemory, PackRelation } from '../../../utils/packMemory'

/**
 * Painting the Atlas neighbourhood.
 *
 * Split in two on purpose (see the perf budget in the plan):
 *
 *  - `paintStatic` draws the road, the nodes and their numbers. It runs when the
 *    data, the window or the size changes.
 *  - `paintDynamic` draws the aurora and the selection ring. Cheap, and painted
 *    once — the "you are here" pulse is CSS on a DOM element so no rAF loop has
 *    to stay alive.
 *
 * Deliberately no `ctx.filter = 'blur()'`: canvas blur is the most reliable way
 * to drop frames on a mid-range Android. Every glow is a baked
 * `createRadialGradient`, which the GPU handles as an ordinary fill.
 */

export interface AtlasColors {
  held: string
  fading: string
  active: string
  ahead: string
  /** Rim kept on any pack ever conquered — never removed, even while fading. */
  heldRim: string
  route: string
  routeDone: string
  aurora: string
  ink: string
  inkDim: string
  band: Record<number, string>
  isLight: boolean
}

/** Reads the live theme so the Atlas follows dark/light without a second palette. */
export function readAtlasColors(root: HTMLElement): AtlasColors {
  const s = getComputedStyle(root)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  const attr = root.getAttribute('data-theme')
  const isLight = attr === 'light'
    || (attr !== 'dark' && window.matchMedia('(prefers-color-scheme: light)').matches)

  return {
    held:      v('--milestone-gold', '#F0B429'),
    fading:    '#F59E0B',
    active:    v('--accent-bright', '#A78BFA'),
    ahead:     isLight ? 'rgba(17,24,39,0.10)' : 'rgba(255,255,255,0.08)',
    heldRim:   v('--points-gold', '#F5C451'),
    route:     v('--route-line', 'rgba(255,255,255,0.14)'),
    routeDone: v('--accent', '#8B5CF6'),
    aurora:    v('--route-glow', 'rgba(139,92,246,0.38)'),
    ink:       isLight ? '#111827' : '#FFFFFF',
    inkDim:    isLight ? 'rgba(17,24,39,0.42)' : 'rgba(255,255,255,0.40)',
    band: {
      1: v('--accent-yellow', '#eab308'),
      2: v('--accent-orange', '#f97316'),
      3: v('--accent-green', '#22c55e'),
      4: v('--accent-blue', '#3b82f6'),
    },
    isLight,
  }
}

function fillFor(relation: PackRelation, c: AtlasColors): string {
  switch (relation) {
    case 'held':   return c.held
    case 'fading': return c.fading
    case 'active': return c.active
    default:       return c.ahead
  }
}

export interface StaticPaintInput {
  layout: AtlasLayout
  memory: Map<string, PackMemory>
  colors: AtlasColors
  /** Catalogue index of the frontier — the node the marker sits on. */
  frontierGlobal: number
  /** 0→1 reveal used by the entrance animation; 1 = fully drawn. */
  progress?: number
}

/** Sets up the backing store at a capped DPR and returns the scale used. */
export function sizeCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): number {
  // Capped at 2: a 3× phone gains no visible fidelity here and pays 125% more
  // pixels for every paint.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return dpr
}

export function paintStatic(ctx: CanvasRenderingContext2D, input: StaticPaintInput) {
  const { layout, memory, colors, frontierGlobal } = input
  const progress = input.progress ?? 1
  const { nodes } = layout

  ctx.clearRect(0, 0, layout.width, layout.height)
  if (nodes.length === 0) return

  const revealed = Math.max(0, Math.min(nodes.length, Math.round(nodes.length * progress)))

  drawRoute(ctx, layout, colors, frontierGlobal, revealed)
  for (let i = 0; i < revealed; i++) {
    drawNode(ctx, layout, nodes[i], memory.get(nodes[i].id), colors, frontierGlobal)
  }
}

/**
 * The road, as a curve through the node centres.
 *
 * Straight segments with square turns read as ruled paper; midpoint quadratics
 * plus the per-row bow read as a road. Stroked twice — a dim base for the whole
 * window (the road ahead has to stay visible, the principle RouteMap follows on
 * Postęp) and a lit overlay for ground already covered.
 */
function tracePath(ctx: CanvasRenderingContext2D, nodes: AtlasNode[], from: number, to: number) {
  if (to - from < 2) return
  ctx.beginPath()
  ctx.moveTo(nodes[from].x, nodes[from].y)
  for (let i = from + 1; i < to - 1; i++) {
    const a = nodes[i]
    const b = nodes[i + 1]
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
  }
  const last = nodes[to - 1]
  ctx.lineTo(last.x, last.y)
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  layout: AtlasLayout,
  colors: AtlasColors,
  frontierGlobal: number,
  revealed: number,
) {
  const { nodes } = layout
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  tracePath(ctx, nodes, 0, revealed)
  ctx.strokeStyle = colors.route
  ctx.lineWidth = 6
  ctx.stroke()

  const lit = Math.min(revealed, nodes.findIndex(n => n.globalIndex >= frontierGlobal) + 1)
  if (lit > 1) {
    tracePath(ctx, nodes, 0, lit)
    ctx.strokeStyle = colors.routeDone
    ctx.globalAlpha = 0.85
    ctx.lineWidth = 6
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

/**
 * One pack: a filled disc carrying its route number.
 *
 * The number is the point. At this scale the map stops being a texture and
 * becomes readable — you can see that you are at #121 and that #124 is three
 * stops away, which is the orientation the whole screen exists to give.
 */
function drawNode(
  ctx: CanvasRenderingContext2D,
  layout: AtlasLayout,
  node: AtlasNode,
  mem: PackMemory | undefined,
  colors: AtlasColors,
  frontierGlobal: number,
) {
  const relation = mem?.relation ?? 'ahead'
  const r = layout.radius
  const ahead = relation === 'ahead'
  const isFrontier = node.globalIndex === frontierGlobal

  // Body
  ctx.beginPath()
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
  ctx.fillStyle = fillFor(relation, colors)
  ctx.globalAlpha = ahead ? 1 : 0.95
  ctx.fill()
  ctx.globalAlpha = 1

  // ── The rule: a pack ever conquered keeps its gold rim forever ───────────
  // Fading dims the fill only. Losing the rim would read as "you lost this",
  // which is exactly what the design must never say. On held ground the fill
  // already says "yours" so the rim is quiet; on fading ground the fill has gone
  // amber, so the rim steps up and carries the reassurance alone.
  if (mem?.everHeld) {
    ctx.beginPath()
    ctx.arc(node.x, node.y, r + 2, 0, Math.PI * 2)
    ctx.strokeStyle = colors.heldRim
    ctx.lineWidth = relation === 'fading' ? 2 : 1.2
    ctx.globalAlpha = relation === 'fading' ? 0.95 : 0.5
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Number. Always drawn, the frontier included — its ring lives on the DOM pin
  // outside the disc precisely so this stays readable.
  ctx.font = `800 ${r < 11 ? 9 : 10}px Montserrat, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ahead
    ? colors.inkDim
    : (colors.isLight && relation === 'held' ? '#3A2600' : '#1A1040')
  ctx.fillText(String(node.num), node.x, node.y + 0.5)

  // The frontier's own disc gets a brighter face so it reads as "now" even
  // before the pin's ring is noticed.
  if (isFrontier && ahead) {
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
    ctx.strokeStyle = colors.active
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

export interface DynamicPaintInput {
  layout: AtlasLayout
  colors: AtlasColors
  frontier: AtlasNode | null
  selected: AtlasNode | null
}

/**
 * The overlay — painted once, never animated here. The frontier's resting pulse
 * lives on `.atlas__pin` in CSS, which is what lets the rAF loop stop dead once
 * the entrance finishes instead of compositing frames forever.
 */
export function paintDynamic(ctx: CanvasRenderingContext2D, input: DynamicPaintInput) {
  const { layout, colors, frontier, selected } = input
  ctx.clearRect(0, 0, layout.width, layout.height)

  if (frontier) {
    // Aurora — the CompassHero idea, in two dimensions: the map brightens at the
    // point you have reached.
    const g = ctx.createRadialGradient(frontier.x, frontier.y, 0, frontier.x, frontier.y, 92)
    g.addColorStop(0, colors.aurora)
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.fillRect(frontier.x - 92, frontier.y - 92, 184, 184)
  }

  if (selected) {
    ctx.beginPath()
    ctx.arc(selected.x, selected.y, layout.radius + 7, 0, Math.PI * 2)
    ctx.strokeStyle = colors.active
    ctx.lineWidth = 2
    ctx.stroke()
  }
}
