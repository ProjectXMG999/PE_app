import { AtlasLayout, AtlasNode } from './atlasLayout'
import { PackMemory, PackRelation } from '../../../utils/packMemory'

/**
 * Painting the Atlas.
 *
 * Split in two on purpose (see the perf budget in the plan):
 *
 *  - `paintStatic` draws everything that only changes when the data or the size
 *    changes — the route, the fog, the terrain bands, the 864 nodes. It is
 *    expensive and runs at most once per data change.
 *  - `paintDynamic` draws the handful of things that move — the aurora, the
 *    "you are here" marker, the tapped node's halo. It is cheap enough to run
 *    inside a gesture.
 *
 * Deliberately no `ctx.filter = 'blur()'` anywhere: canvas blur is the single
 * most reliable way to drop frames on a mid-range Android. Every glow here is a
 * baked `createRadialGradient`, which the GPU handles as an ordinary fill.
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
  fog: string
  band: Record<number, string>
  /** Light theme needs far gentler washes — see the alphas below. */
  isLight: boolean
  /** Opacity of the level territory washes. */
  washAlpha: number
  /** Opacity of the fog over unreached ground. */
  fogAlpha: number
}

/** Reads the live theme so the Atlas follows dark/light without a second palette. */
export function readAtlasColors(root: HTMLElement): AtlasColors {
  const s = getComputedStyle(root)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  const attr = root.getAttribute('data-theme')
  const isLight = attr === 'light'
    || (attr !== 'dark' && window.matchMedia('(prefers-color-scheme: light)').matches)

  return {
    held:     v('--milestone-gold', '#F0B429'),
    fading:   '#F59E0B',
    active:   v('--accent-bright', '#A78BFA'),
    ahead:    v('--route-line', 'rgba(255,255,255,0.14)'),
    heldRim:  v('--points-gold', '#F5C451'),
    route:    v('--route-line', 'rgba(255,255,255,0.14)'),
    routeDone: v('--accent', '#8B5CF6'),
    aurora:   v('--route-glow', 'rgba(139,92,246,0.38)'),
    // Fog fades toward the card it sits on, not the page ground. Using
    // --bg-primary put a near-white veil over the light theme's washes and
    // turned the whole lower map into one muddy field.
    fog:      v('--bg-card', '#241B5C'),
    band: {
      1: v('--accent-yellow', '#eab308'),
      2: v('--accent-orange', '#f97316'),
      3: v('--accent-green', '#22c55e'),
      4: v('--accent-blue', '#3b82f6'),
    },
    isLight,
    // Saturated washes and heavy fog read as dirt on a light ground, where
    // there is no darkness for them to glow against.
    washAlpha: isLight ? 0.09 : 0.17,
    fogAlpha:  isLight ? 0.4 : 0.62,
  }
}

const RELATION_ALPHA: Record<PackRelation, number> = {
  held: 1, fading: 0.95, active: 1, ahead: 0.5,
}

function colorFor(relation: PackRelation, c: AtlasColors): string {
  switch (relation) {
    case 'held':   return c.held
    case 'fading': return c.fading
    case 'active': return c.active
    default:       return c.ahead
  }
}

export interface Monument {
  /** Node index where the curriculum crosses this threshold. */
  index: number
  /** Cumulative words at the threshold — 1 000 / 3 000 / 6 000 / 10 000. */
  words: number
  level: number
}

export interface StaticPaintInput {
  layout: AtlasLayout
  memory: Map<string, PackMemory>
  colors: AtlasColors
  /** Index of the frontier node; everything past it sits under fog. */
  frontierIndex: number
  /** The four level stations, by node index. */
  monuments: Monument[]
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
  const { layout, memory, colors, frontierIndex } = input
  const progress = input.progress ?? 1
  const { nodes, radius } = layout

  ctx.clearRect(0, 0, layout.width, layout.height)
  if (nodes.length === 0) return

  // How far along the route the entrance animation has swept.
  const revealed = Math.max(0, Math.min(nodes.length, Math.round(nodes.length * progress)))

  // Territory first, then the road, then the places on it — the same order a
  // real map is drawn in, and the reason this reads as terrain rather than a
  // scatter plot even before any progress exists.
  drawTerritory(ctx, layout, colors, revealed)
  drawRoute(ctx, layout, colors, frontierIndex, revealed)
  drawMonuments(ctx, layout, colors, input.monuments, revealed)

  for (let i = 0; i < revealed; i++) {
    const node = nodes[i]
    const mem = memory.get(node.id)
    const relation = mem?.relation ?? 'ahead'
    drawNode(ctx, node, relation, mem, colors, radius, i > frontierIndex)
  }

  drawFog(ctx, layout, colors, frontierIndex, revealed)
}

/**
 * Soft level-coloured washes behind the route.
 *
 * This is what gives an empty account something to look at. Without it a new
 * user sees 864 identical grey dots — technically a map, emotionally a blank
 * form. The bands are the curriculum's own four difficulty tiers, so the colour
 * is information, not decoration.
 */
function drawTerritory(
  ctx: CanvasRenderingContext2D,
  layout: AtlasLayout,
  colors: AtlasColors,
  revealed: number,
) {
  const { nodes, stepY, width } = layout
  if (revealed === 0) return

  // One wash per contiguous run of the same level.
  let start = 0
  for (let i = 1; i <= revealed; i++) {
    const ended = i === revealed || nodes[i].level !== nodes[start].level
    if (!ended) continue

    const level = nodes[start].level
    const top = nodes[start].y - stepY * 0.9
    const bottom = nodes[i - 1].y + stepY * 0.9
    const tint = colors.band[level] ?? colors.routeDone

    const wash = ctx.createLinearGradient(0, top, 0, bottom)
    wash.addColorStop(0, 'transparent')
    wash.addColorStop(0.5, tint)
    wash.addColorStop(1, 'transparent')
    ctx.globalAlpha = colors.washAlpha
    ctx.fillStyle = wash
    ctx.fillRect(0, top, width, bottom - top)
    ctx.globalAlpha = 1

    start = i
  }
}

/**
 * The route itself, drawn as a curve rather than a polyline.
 *
 * Straight segments with square turns read as ruled paper. Feeding the node
 * centres through midpoint quadratics turns the same points into a road that
 * bends — combined with the per-row bow from `rowOffset`, that's the whole
 * difference between a grid and a map.
 *
 * Stroked twice: a dim base for the entire path (the road ahead must stay
 * visible — the principle RouteMap follows on Postęp) and a lit overlay up to
 * the frontier.
 */
function tracePath(ctx: CanvasRenderingContext2D, layout: AtlasLayout, from: number, to: number) {
  const { nodes } = layout
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
  frontierIndex: number,
  revealed: number,
) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Thin: the road ahead has to stay legible without reading as a row of pipes,
  // which is what a heavy stroke at this density looks like.
  tracePath(ctx, layout, 0, revealed)
  ctx.strokeStyle = colors.route
  ctx.lineWidth = 1.4
  ctx.stroke()

  const lit = Math.min(revealed, frontierIndex + 1)
  if (lit > 1) {
    tracePath(ctx, layout, 0, lit)
    ctx.strokeStyle = colors.routeDone
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

/**
 * The four level stations, marked where the curriculum crosses 1 000 / 3 000 /
 * 6 000 / 10 000 cumulative words.
 *
 * Emphatically NOT one per `pack.level` change: the difficulty tag is not
 * monotonic along the route (L1…L4 interleave from Tom II onward), so keying off
 * it scatters dozens of marks across the map instead of four landmarks.
 */
function drawMonuments(
  ctx: CanvasRenderingContext2D,
  layout: AtlasLayout,
  colors: AtlasColors,
  monuments: Monument[],
  revealed: number,
) {
  const { nodes } = layout
  for (const m of monuments) {
    if (m.index >= revealed) continue
    const n = nodes[m.index]
    if (!n) continue
    const tint = colors.band[m.level] ?? colors.routeDone

    const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 26)
    halo.addColorStop(0, tint)
    halo.addColorStop(1, 'transparent')
    ctx.globalAlpha = 0.3
    ctx.fillStyle = halo
    ctx.fillRect(n.x - 26, n.y - 26, 52, 52)

    ctx.globalAlpha = 0.95
    ctx.beginPath()
    ctx.arc(n.x, n.y, 6.5, 0, Math.PI * 2)
    ctx.strokeStyle = tint
    ctx.lineWidth = 1.8
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

/**
 * Fog over ground not yet reached — desire, and a way to stop 864 dots from
 * shouting at once. Deliberately partial: you can still make out the shape of
 * what's coming, which is the point.
 */
function drawFog(
  ctx: CanvasRenderingContext2D,
  layout: AtlasLayout,
  colors: AtlasColors,
  frontierIndex: number,
  revealed: number,
) {
  const { nodes, height, width } = layout
  if (revealed === 0 || frontierIndex >= nodes.length - 1) return
  const edge = nodes[Math.min(frontierIndex + 1, nodes.length - 1)].y
  if (edge >= height) return

  const fog = ctx.createLinearGradient(0, edge - 10, 0, height)
  fog.addColorStop(0, 'transparent')
  fog.addColorStop(1, colors.fog)
  ctx.globalAlpha = colors.fogAlpha
  ctx.fillStyle = fog
  ctx.fillRect(0, edge - 10, width, height - edge + 10)
  ctx.globalAlpha = 1
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: AtlasNode,
  relation: PackRelation,
  mem: PackMemory | undefined,
  colors: AtlasColors,
  radius: number,
  underFog: boolean,
) {
  const r = relation === 'ahead' ? radius * 0.78 : radius
  ctx.globalAlpha = RELATION_ALPHA[relation] * (underFog ? 0.55 : 1)

  ctx.beginPath()
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
  ctx.fillStyle = colorFor(relation, colors)
  ctx.fill()

  // ── The rule: a pack ever conquered keeps its gold rim forever ───────────
  // Fading dims the fill only. Losing the rim would read as "you lost this",
  // which is exactly what the design must never say.
  //
  // Weighting matters as much as presence: on held ground the fill already says
  // "yours", so the rim stays a whisper — at full strength on every conquered
  // node it turned the map into a bead chain. On fading ground the fill has gone
  // amber, so the rim steps up and carries the reassurance on its own.
  if (mem?.everHeld) {
    ctx.beginPath()
    ctx.arc(node.x, node.y, r + 1.5, 0, Math.PI * 2)
    ctx.strokeStyle = colors.heldRim
    ctx.lineWidth = relation === 'fading' ? 1.2 : 0.8
    ctx.globalAlpha = relation === 'fading' ? 0.9 : 0.28
    ctx.stroke()
  }

  ctx.globalAlpha = 1
}

export interface DynamicPaintInput {
  layout: AtlasLayout
  colors: AtlasColors
  /** Node the "you are here" marker sits on. */
  frontier: AtlasNode | null
  /** Currently pressed/selected node, if any. */
  selected: AtlasNode | null
}

/**
 * The moving layer — and it is deliberately *not* animated here.
 *
 * The resting pulse of the frontier marker lives on a CSS-animated DOM element
 * (`.atlas__pin`) instead, so this canvas is painted once and the rAF loop can
 * stop dead when the entrance finishes. A pulse drawn on canvas would have kept
 * a requestAnimationFrame loop alive for as long as the map was on screen, which
 * is exactly the idle battery drain the design set out to avoid.
 */
export function paintDynamic(ctx: CanvasRenderingContext2D, input: DynamicPaintInput) {
  const { layout, colors, frontier, selected } = input
  ctx.clearRect(0, 0, layout.width, layout.height)

  if (frontier) {
    // Aurora — the CompassHero idea, finally in two dimensions: the map itself
    // brightens at the point you have reached.
    const glow = ctx.createRadialGradient(frontier.x, frontier.y, 0, frontier.x, frontier.y, 86)
    glow.addColorStop(0, colors.aurora)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(frontier.x - 86, frontier.y - 86, 172, 172)
  }

  if (selected) {
    ctx.beginPath()
    ctx.arc(selected.x, selected.y, 8, 0, Math.PI * 2)
    ctx.strokeStyle = colors.active
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}
