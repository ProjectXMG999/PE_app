/**
 * Route chunks, fetched before they're needed.
 *
 * Every page but Dzisiaj is a lazy import, so the first visit to one used to
 * mean: tap, nothing, chunk downloads, page appears. With a view transition on
 * top of that the wait became visible as a frozen screen — the outgoing page
 * held as a still image until the incoming one could be rendered. The fix isn't
 * to wait more gracefully, it's not to wait at all:
 *
 *  • `preloadPath` on first touch — pointerdown lands 80–150ms before the click
 *    on a phone, and on a warm dev server that's the whole fetch.
 *  • `warmPages` shortly after boot, so by the time anything is tapped the
 *    chunks are already in memory. It's a handful of small view modules; the
 *    weight of this app is its data and audio.
 *
 * Both are idempotent — a module is only ever fetched once — and both are
 * best-effort: a failed warm-up just means the normal lazy path runs later.
 */

type Loader = () => Promise<unknown>

interface Entry {
  /** Matched against the pathname (query and hash stripped). */
  match: RegExp
  load: Loader
  started: boolean
  /** Resolved, i.e. the page can be rendered synchronously right now. */
  ready: boolean
}

const entries: Entry[] = []

/** Called from the route table as each lazy page is declared. */
export function registerPage(match: RegExp, load: Loader) {
  entries.push({ match, load, started: false, ready: false })
}

function pathname(path: string): string {
  return path.split('?')[0].split('#')[0]
}

function entryFor(path: string): Entry | undefined {
  return entries.find(e => e.match.test(pathname(path)))
}

function start(entry: Entry): Promise<unknown> {
  if (entry.started) return Promise.resolve()
  entry.started = true
  return entry.load()
    .then(() => { entry.ready = true })
    .catch(() => { entry.started = false })
}

/** Fetch the chunk that will render `path`, if it isn't already in memory. */
export function preloadPath(path: string) {
  const entry = entryFor(path)
  if (entry) void start(entry)
}

/**
 * Can `path` be rendered in this tick? A transition wraps a synchronous render
 * (see transitions.ts); a route whose chunk is still in flight would render its
 * Suspense fallback instead, so those navigate without one.
 *
 * Pages that aren't lazy at all — Dzisiaj — match no entry and are always
 * ready.
 */
export function isPageLoaded(path: string): boolean {
  const entry = entryFor(path)
  return !entry || entry.ready
}

/**
 * One chunk at a time, so warming never competes with something the user is
 * actually waiting for.
 *
 * Skipped entirely on Data Saver, and on a connection that reports itself as
 * 2g: there the ~550 kB this fetches is not a head start, it is the thing
 * standing between the user and the screen they asked for. The normal lazy path
 * still runs when they tap, which on such a link is the honest trade.
 */
export async function warmPages() {
  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection
  if (conn?.saveData) return
  if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return
  for (const entry of entries) await start(entry)
}
