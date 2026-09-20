import { useCallback, useLayoutEffect } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import type { NavigateOptions } from 'react-router-dom'
import { navigateWithTransition, popWithTransition, settle } from './transitions'

/**
 * Where you came from, and how to get back there.
 *
 * Every study flow (mode chooser → session → done screen) can be entered from
 * more than one place — Dzisiaj launches straight into a pack's mode chooser,
 * Pakiety goes through the pack page first. A back button with a hard-coded
 * target can only be right for one of those, so the flows here don't have one:
 *
 *  • **Origin.** The page that launches a flow stamps itself into the
 *    navigation state as `origin`. Every later step of the flow inherits it
 *    untouched (`useAppNavigate`), so the done screen three screens later still
 *    knows it was started from Dzisiaj.
 *  • **Structural parent.** With no origin — a deep link, a refresh on an old
 *    entry, a PWA shortcut — back falls through to the page one level up in
 *    the route tree (`structuralParent`). Never out of the app.
 *  • **Return, don't advance.** Going back pops the browser history down to the
 *    origin's own entry instead of pushing a fresh copy of it on top. Otherwise
 *    the system back gesture on Dzisiaj walks you back into the session you just
 *    closed. That needs to know which in-app path sits at which history index,
 *    which the router doesn't expose — `NavigationTracker` records it.
 */

// ── Model ────────────────────────────────────────────────────────────────────

/** The tabs. A flow's origin always resolves to one of these for nav highlight. */
export type Hub = '/dzis' | '/pakiety' | '/trening' | '/postęp' | '/ustawienia'

export const HOME: Hub = '/dzis'

export interface NavOrigin {
  /** Pathname (+ search) to return to. */
  path: string
  /** History index of that entry when the flow was launched, if known. */
  idx?: number
  /** The tab this whole trail hangs off — keeps the right tab lit mid-flow. */
  hub: Hub
}

interface Target {
  path: string
  hub: Hub
  /** Short name, for a back pill: "Dzisiaj", "Pakiet". */
  label: string
  /** Full phrase, for an aria-label or a text button: "Wróć do pakietu". */
  backLabel: string
}

const HUB_NAMES: Record<Hub, { label: string; backLabel: string }> = {
  '/dzis': { label: 'Dzisiaj', backLabel: 'Wróć do Dzisiaj' },
  '/pakiety': { label: 'Pakiety', backLabel: 'Wróć do pakietów' },
  '/trening': { label: 'Trening', backLabel: 'Wróć do treningu' },
  '/postęp': { label: 'Postęp', backLabel: 'Wróć do postępu' },
  '/ustawienia': { label: 'Ustawienia', backLabel: 'Wróć do ustawień' },
}

/**
 * The tabs, left to right, exactly as the bar draws them (NAV_ITEMS).
 *
 * Which way a tab switch travels is read off this: moving right along the bar
 * brings the new screen in from the right, moving left brings it in from the
 * left. A tab bar is a row, not a stack, and animating it as one — every switch
 * a cross-dissolve, or worse, every switch a push — throws away the one spatial
 * fact the user already has on screen.
 */
const HUB_ORDER: Hub[] = ['/dzis', '/pakiety', '/trening', '/postęp', '/ustawienia']

/** Which way the page should travel when switching from one tab to another. */
export function hubDirection(from: Hub | null, to: Hub): 'forward' | 'back' | 'lateral' {
  if (!from || from === to) return 'lateral'
  const a = HUB_ORDER.indexOf(from)
  const b = HUB_ORDER.indexOf(to)
  if (a < 0 || b < 0) return 'lateral'
  return b > a ? 'forward' : 'back'
}

function decodePath(pathname: string): string {
  try { return decodeURIComponent(pathname) } catch { return pathname }
}

const PACK_PAGE = /^\/pakiet\/[^/]+$/
const PACK_FLOW = /^(\/pakiet\/[^/]+)\/.+$/

function asHub(path: string): Hub | null {
  // Hash and query stripped: a target like '/postęp#powtorki' is still the
  // Postęp tab, and reading it as a deeper page would make a tab hop travel.
  const p = decodePath(path.split('?')[0].split('#')[0])
  return p in HUB_NAMES ? (p as Hub) : null
}

/** Pages a flow can be launched from — and so can be returned to. */
function isOriginPage(pathname: string): boolean {
  const p = decodePath(pathname)
  return asHub(p) != null || PACK_PAGE.test(p)
}

function describe(path: string, hub: Hub): Target {
  const h = asHub(path)
  if (h) return { path, hub: h, ...HUB_NAMES[h] }
  if (PACK_PAGE.test(decodePath(path.split('?')[0]))) {
    return { path, hub, label: 'Pakiet', backLabel: 'Wróć do pakietu' }
  }
  return { path, hub, ...HUB_NAMES[hub] }
}

/** The tab a path belongs to by URL alone, ignoring how you got there. */
function hubOfPath(pathname: string): Hub {
  const p = decodePath(pathname)
  const h = asHub(p)
  if (h) return h
  if (p === '/powtorka' || p === '/inteligentny') return '/dzis'
  if (p.startsWith('/trening/')) return '/trening'
  if (p.startsWith('/postęp/')) return '/postęp'
  if (p.startsWith('/pakiet')) return '/pakiety'
  return HOME
}

/** One level up the route tree — where back goes when there's no origin. */
function structuralParent(pathname: string): string {
  const p = decodePath(pathname)
  const flow = PACK_FLOW.exec(p)
  if (flow) return flow[1]
  if (PACK_PAGE.test(p)) return '/pakiety'
  if (p.startsWith('/trening/')) return '/trening'
  return HOME
}

function readOrigin(state: unknown): NavOrigin | null {
  const o = (state as { origin?: NavOrigin } | null)?.origin
  return o && typeof o.path === 'string' ? o : null
}

// ── History ledger ───────────────────────────────────────────────────────────

const LEDGER_KEY = 'pe:nav-ledger'

/** BrowserRouter keeps a monotonically assigned index in history.state. */
function currentIdx(): number {
  const idx = (window.history.state as { idx?: number } | null)?.idx
  return typeof idx === 'number' ? idx : 0
}

/** idx → pathname of every in-app history entry this tab has seen. Kept in
 *  sessionStorage, which has exactly the lifetime of the tab's history. */
function readLedger(): Record<number, string> {
  try { return JSON.parse(sessionStorage.getItem(LEDGER_KEY) ?? '{}') } catch { return {} }
}

function writeLedger(ledger: Record<number, string>) {
  try { sessionStorage.setItem(LEDGER_KEY, JSON.stringify(ledger)) } catch { /* private mode */ }
}

/** A replace to run once a history pop lands on `idx` — used when the entry
 *  being returned to needs different state than it was left with. */
let pendingReplace: { idx: number; path: string; state: unknown } | null = null

/**
 * Records which path lives at which history index, and completes any pending
 * return. Mount once, inside the router.
 */
export function NavigationTracker() {
  const location = useLocation()
  const type = useNavigationType()
  const navigate = useNavigate()

  // Layout effect: a pending replace should land before the popped page paints.
  useLayoutEffect(() => {
    const idx = currentIdx()
    const ledger = readLedger()
    // A push truncates forward history, exactly like the browser does.
    if (type === 'PUSH') for (const k of Object.keys(ledger)) if (Number(k) > idx) delete ledger[Number(k)]
    ledger[idx] = location.pathname
    writeLedger(ledger)

    if (pendingReplace && pendingReplace.idx === idx) {
      const { path, state } = pendingReplace
      pendingReplace = null
      navigate(path, { replace: true, state })
    }

    // The new page is committed and hasn't painted yet: capture it, and the
    // transition that was opened before the navigation plays out. No-op when
    // nothing opened one (a deep link, a browser gesture).
    settle()
  }, [location, type, navigate])

  return null
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export interface AppNavigateOptions extends NavigateOptions {
  /**
   * 'forward' (default): a step deeper. From an origin page the current page
   * becomes the origin; from inside a flow, the flow's origin is carried on.
   * 'sideways': same depth — next pack, related pack, mode toggle. Replaces the
   * current entry and keeps its origin, so back still leads out of the flow.
   */
  step?: 'forward' | 'sideways'
}

/** `navigate` that threads the origin through a flow. Use it for every
 *  in-flow navigation; tab switches can stay plain links. */
export function useAppNavigate() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback((to: string, opts: AppNavigateOptions = {}) => {
    const { step = 'forward', state, ...rest } = opts
    const inherited = readOrigin(location.state)
    let origin: NavOrigin | null
    if (step === 'sideways') {
      origin = inherited
    } else if (isOriginPage(location.pathname)) {
      origin = {
        path: location.pathname + location.search,
        idx: currentIdx(),
        hub: asHub(location.pathname) ?? inherited?.hub ?? hubOfPath(location.pathname),
      }
    } else {
      origin = inherited
    }
    // Switching tabs isn't entering a flow — a hub never carries an origin.
    if (asHub(to)) origin = null
    // A step deeper travels; a tab switch or a same-depth hop (next pack, mode
    // toggle) dissolves in place — moving sideways shouldn't read as descending.
    const dir = step === 'sideways' || asHub(to) ? 'lateral' : 'forward'
    navigateWithTransition(dir, to, () => navigate(to, {
      ...rest,
      replace: step === 'sideways' ? true : rest.replace,
      state: origin ? { ...(state as object | null), origin } : state,
    }))
  }, [navigate, location])
}

/**
 * The way out of the current page: the flow's origin if there is one, the
 * structural parent otherwise. `goBack(state?)` returns there by popping
 * history when the entry is still behind us, and by replacing the current
 * entry when it isn't.
 */
export function useBack() {
  const navigate = useNavigate()
  const location = useLocation()
  const origin = readOrigin(location.state)
  const target = origin
    ? describe(origin.path, origin.hub)
    : (() => {
        const parent = structuralParent(location.pathname)
        return describe(parent, hubOfPath(parent))
      })()

  const goBack = useCallback((state?: unknown) => {
    const here = currentIdx()
    const ledger = readLedger()
    const wanted = target.path.split('?')[0]
    // Where the target sits in history: the index the origin recorded, or —
    // with no origin — the entry directly behind, if that's the parent.
    const at = origin?.idx != null ? origin.idx : here - 1
    const entry = at >= 0 && at < here ? ledger[at] : undefined

    if (entry != null && (origin?.idx != null || decodePath(entry) === decodePath(wanted))) {
      // Sideways hops can leave a different path at that index (the pack page
      // of the first pack in a "next pack" chain); fix it up after the pop.
      const needsReplace = decodePath(entry) !== decodePath(wanted) || state !== undefined
      if (needsReplace) pendingReplace = { idx: at, path: target.path, state: state ?? null }
      popWithTransition('back', () => navigate(at - here))
      return
    }
    navigateWithTransition('back', target.path, () => navigate(target.path, { replace: true, state }))
  }, [navigate, origin?.idx, target.path])

  return { goBack, path: target.path, label: target.label, backLabel: target.backLabel, hub: target.hub }
}

/** Pages outside the tab structure — reached from the top bar's account
 *  button, not from a tab — so no tab claims them. */
const OFF_TAB = new Set(['/konto', '/logowanie'])

/** The tab to light up for the current page, or null when none owns it. */
export function useActiveHub(): Hub | null {
  const location = useLocation()
  if (OFF_TAB.has(decodePath(location.pathname))) return null
  return asHub(location.pathname) ?? readOrigin(location.state)?.hub ?? hubOfPath(location.pathname)
}
