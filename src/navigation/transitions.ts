import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { MouseEvent } from 'react'
import type { NavigateOptions } from 'react-router-dom'
import { isPageLoaded, preloadPath } from './pageChunks'

/**
 * One motion vocabulary for moving between pages.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 * The app used to ask react-router for transitions: `<Link viewTransition>` and
 * `navigate(to, { viewTransition: true })`, on about five of the forty ways to
 * leave a page. None of them ever ran. That option is implemented inside
 * `RouterProvider` (the data router); under `<BrowserRouter>` it reaches
 * `navigator.push(path, state, options)` — plain `history.push`, whose third
 * argument doesn't exist. So the whole app cut hard between screens, and the
 * only page that felt like it arrived (Pakiety) was earning that with its own
 * row cascade, not with a transition.
 *
 * So the transition is driven here instead, and the rules hold app-wide:
 *
 *  • **Every in-app navigation is a transition.** `useAppNavigate`, `useBack`,
 *    `useTransitionNavigate` and `linkTransition` all go through `open()`.
 *    Nothing has to remember to ask.
 *  • **The direction is stamped on the document** as `<html data-nav>` before
 *    the snapshot is taken, and animations.css reads it. Forward brings the new
 *    page in from the right, back is its mirror, lateral (tab → tab, next pack,
 *    mode toggle) dissolves in place.
 *  • **Only the page travels.** The chrome — top bar, tab bar, sidebar, active
 *    tab marker — is named in animations.css so it sits the transition out
 *    instead of cross-fading with the content behind it.
 *
 * ── How the two halves meet ─────────────────────────────────────────────────
 * `document.startViewTransition(cb)` captures the outgoing screen the moment
 * it's called and captures the incoming one when `cb`'s promise settles. Our
 * DOM update is a router navigation: it lands a tick later, through React, and
 * for a history pop there is no callback to hang it on at all. So `open()`
 * hands back a promise it keeps, and `settle()` — called by NavigationTracker
 * once the new page is committed and before it paints — resolves it. The
 * timeout is the safety net: a navigation that never happens (a guard, a
 * blocked pop) must not strand the screen under a frozen snapshot.
 *
 * Browsers without the API (iOS < 18) navigate exactly as they did before.
 */

export type NavDirection = 'forward' | 'back' | 'lateral'

/** How long the page animation runs (animations.css), plus slack. */
const SETTLE_MS = 700

/**
 * Only history pops wait: how long we'll hold the outgoing frame before giving
 * up on one. See `popWithTransition`.
 */
const POP_TIMEOUT_MS = 250

// ── Direction ────────────────────────────────────────────────────────────────

let clearTimer = 0

/**
 * Stamp which way the app is moving. Must happen BEFORE the navigation: the
 * outgoing snapshot, and the CSS that animates it, are both decided then.
 *
 * The stamp clears itself — a stale `data-nav` would hand its direction to the
 * next transition that didn't set one (a browser back gesture, say).
 */
export function markDirection(dir: NavDirection) {
  const el = document.documentElement
  el.dataset.nav = dir
  window.clearTimeout(clearTimer)
  clearTimer = window.setTimeout(() => { delete el.dataset.nav }, SETTLE_MS)
}

// ── The transition itself ────────────────────────────────────────────────────

interface ViewTransition {
  skipTransition: () => void
  finished: Promise<void>
}

type StartViewTransition = (cb: () => void | Promise<void>) => ViewTransition

function viewTransitions(): StartViewTransition | null {
  const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition
  return typeof start === 'function' ? start.bind(document) : null
}

/**
 * Push navigations: the router update runs INSIDE the transition callback,
 * flushed synchronously.
 *
 * This is the part that took a rewrite to get right. `startViewTransition()`
 * does not photograph the outgoing page when you call it — it photographs at
 * the next rendering opportunity, just before running the callback. So
 * "start a transition, then navigate" loses the race whenever React commits
 * inside the click handler, which is most of the time: the DOM has already
 * become the new page by the time the "before" photo is taken, the two
 * snapshots match, and nothing animates. Measured on the dev server, that was
 * every single navigation — with the screen frozen for a quarter of a second
 * first, waiting for a commit that had already happened.
 *
 * `flushSync` inside the callback puts the commit where it belongs: after the
 * capture, before the transition resolves. Nothing waits on a timer, and the
 * only time the screen holds still is the render itself — which no browser
 * could have painted through anyway.
 *
 * One condition: the route's chunk has to be in memory. Rendering a route that
 * isn't loaded commits <LoadingFallback>, and a transition into a spinner is
 * worse than no transition. Those navigate plainly and kick off the fetch —
 * see pageChunks, which makes this rare.
 */
export function navigateWithTransition(dir: NavDirection, to: string, navigate: () => void) {
  markDirection(dir)
  const start = viewTransitions()
  if (!start || !isPageLoaded(to)) {
    preloadPath(to)
    navigate()
    return
  }
  start(() => { flushSync(navigate) })
}

/**
 * History pops (`useBack`) can't use the callback above: `navigate(-1)` reaches
 * the router through a popstate event, which the browser fires in its own time,
 * so there is nothing to flush synchronously. Here the capture race works in
 * our favour — a pop can't possibly have changed the DOM before the photo is
 * taken — so the callback returns a promise that NavigationTracker resolves
 * once the returned-to page is committed.
 *
 * The timeout is the safety net: a pop that never lands (a blocked navigation)
 * must not leave the screen frozen under a still image.
 */
let pending: (() => void) | null = null
let popTimer = 0
let popping: ViewTransition | null = null

export function popWithTransition(dir: NavDirection, pop: () => void) {
  markDirection(dir)
  const start = viewTransitions()
  if (!start) { pop(); return }
  settle()
  popping = start(() => new Promise<void>(resolve => {
    pending = resolve
    popTimer = window.setTimeout(() => { popping?.skipTransition(); settle() }, POP_TIMEOUT_MS)
  }))
  pop()
}

/** Called by NavigationTracker once a popped-to page is committed. Idempotent,
 *  and a no-op for every navigation that isn't a pop. */
export function settle() {
  const resolve = pending
  if (!resolve) return
  pending = null
  popping = null
  window.clearTimeout(popTimer)
  resolve()
}

// ── Entry points ─────────────────────────────────────────────────────────────

export interface TransitionNavigateOptions extends NavigateOptions {
  /** Defaults to 'forward'. Tab-level and same-depth hops pass 'lateral'. */
  direction?: NavDirection
}

/**
 * `navigate` with the app's transition attached, for hops that carry no flow
 * origin — the top bar's account button, the sidebar's logo, a toast opening
 * the page it's talking about. Anything *inside* a study flow uses
 * `useAppNavigate` instead, which threads the origin through the same
 * machinery.
 */
export function useTransitionNavigate() {
  const navigate = useNavigate()
  return useCallback((to: string, opts: TransitionNavigateOptions = {}) => {
    const { direction = 'forward', ...rest } = opts
    navigateWithTransition(direction, to, () => navigate(to, rest))
  }, [navigate])
}

/**
 * The same, for a real `<a>`: the click handler takes the navigation over so it
 * can happen inside the transition callback. The `<Link>` stays a link — it
 * keeps its href, so ⌘-click, middle-click and "open in new tab" all still work
 * (those clicks fall through untouched, and the browser handles them).
 */
export function useLinkTransition() {
  const navigate = useTransitionNavigate()
  return useCallback((to: string, dir: NavDirection) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to, { direction: dir })
  }, [navigate])
}

// ── Shared elements ──────────────────────────────────────────────────────────

/**
 * A morph — one element on the outgoing page and its counterpart on the
 * incoming one carrying the same `view-transition-name`, so it travels between
 * them instead of cross-fading.
 *
 * Both halves have to opt in, and the page being *entered* can't know whether
 * the page being left named its half. It matters: a lone half still animates —
 * the pack title would fade in place while the page it sits on slides, which
 * reads as a glitch rather than a morph. So the page being left arms the morph
 * by name, and the arriving page claims it.
 *
 * Names are applied for one transition and then removed, never left on: a view
 * transition's cost scales with the number of named elements, and the pack list
 * alone has 864 rows.
 */
let armed: { key: string; at: number } | null = null

export function armMorph(key: string) {
  armed = { key, at: Date.now() }
}

/** Peek, don't consume — this is read during render passes that may repeat. */
export function morphArmed(key: string): boolean {
  return armed != null && armed.key === key && Date.now() - armed.at < 1500
}
