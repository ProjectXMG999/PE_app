import packagesIndex from '../data/packages-index.json'
import { LEVEL_COLORS } from '../data/levels'
import { PackMeta } from '../types/vocabulary'

/**
 * Which routes open with a curtain, and what colour it is.
 *
 * Used before the page itself can say — by the Suspense fallback while its
 * chunk is in flight, and by the entitlement gate while auth resolves. Both of
 * those used to render a spinner on nothing, which is the blank screen the
 * curtain exists to replace, shown in the window right before it.
 *
 * The colour has to match what the page will paint a moment later or the
 * hand-over is a flash: it is the same `accent` each mode passes to
 * SessionOpener — the pack's level colour where the session is pack-scoped,
 * the mode's own accent where it isn't.
 */

const allPacks = packagesIndex as PackMeta[]

/** Paths under /pakiet/:id/ that are choosers, not sessions. */
const CHOOSERS = new Set(['start', 'fiszki-start'])

const PACK_FLOW = /^\/pakiet\/([^/]+)\/([^/]+)$/

function decode(pathname: string): string {
  try { return decodeURIComponent(pathname) } catch { return pathname }
}

export function sessionAccent(pathname: string): string | null {
  const p = decode(pathname.split('?')[0].split('#')[0])

  if (p === '/powtorka') return 'var(--live)'
  if (p === '/inteligentny') return 'var(--accent)'

  const flow = PACK_FLOW.exec(p)
  if (!flow || CHOOSERS.has(flow[2])) return null
  // An unknown pack id still opens a session — the page will show its own
  // error under the curtain — so this falls through to the neutral accent
  // rather than to "not a session".
  const level = allPacks.find(pack => pack.id === flow[1])?.level
  return (level != null && LEVEL_COLORS[level]) || 'var(--accent)'
}
