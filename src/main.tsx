import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './styles/global.css'
import { pushLog } from './debug/audioLogger'
import { measureIosViewportGap } from './utils/iosViewportGap'

// Intercept console logs for the debug overlay (captures [audio], [action],
// [seq] prefixes).
//
// The tag test runs on args[0] alone, BEFORE anything is serialised. The
// previous shape built the full message first — `args.map(a => typeof a ===
// 'object' ? JSON.stringify(a) : String(a)).join(' ')` — and only then asked
// whether it was interesting, so every console call in the app paid a
// JSON.stringify over each of its arguments, in production, to throw the
// result away. Every tagged log in the codebase puts its tag in the first
// argument, so testing that one string loses nothing.
// `[progress]` is here so the snapshot-read timing (useProgressData) reaches the
// in-app overlay as well as the console. The symptom it exists to diagnose —
// a blocked frame on entering a page — only happens on a phone, and requiring
// a USB cable and a desktop Safari to read one number is how a measurement
// stops being taken.
const TAGS = ['[audio]', '[action]', '[seq]', '[progress]']
const tagged = (args: unknown[]) =>
  typeof args[0] === 'string' && TAGS.some(t => (args[0] as string).includes(t))
const serialise = (args: unknown[]) =>
  args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')

const origLog = console.log.bind(console)
const origErr = console.error.bind(console)
console.log = (...args) => {
  origLog(...args)
  if (tagged(args)) pushLog(serialise(args))
}
console.error = (...args) => {
  origErr(...args)
  if (tagged(args)) pushLog('ERR ' + serialise(args))
}
// Wrapped for the same reason as the two above, and no more: an untagged warn
// is passed straight through and never serialised.
const origWarn = console.warn.bind(console)
console.warn = (...args) => {
  origWarn(...args)
  if (tagged(args)) pushLog(serialise(args))
}

// Before React paints: the installed iOS app reports a viewport short by the
// status-bar inset, and everything here is sized off that.
measureIosViewportGap()

// ── TEMPORARY diagnostic, 2026-09-23 — delete once the question is settled ──
// `?noarrive` switches off every entrance animation that sits ON or ABOVE a
// backdrop-filter surface. The artefact it is meant to isolate ("elements are
// greyer at first, then change") reproduces only on the phone: Blink measured
// clean in both pointer modes, and Playwright's WebKit cannot be asked at all
// because it renders backdrop-filter as a no-op. That leaves the device as the
// only oracle, so the A/B has to be one tap on a URL.
if (new URLSearchParams(window.location.search).has('noarrive')) {
  document.documentElement.dataset.noarrive = ''
}

// Force reload when a NEW service worker takes over from an OLD one — that is
// the deploy case, and without it the page keeps asking for chunks the new
// precache no longer has.
//
// `hadController` is what stops it firing on the very first visit. The worker
// calls `skipWaiting()` + `clientsClaim()` (sw/sw.ts), so on a first load it
// installs and claims this page within a second or two — with no guard, that
// claim looked exactly like a deploy and reloaded the app. The first visit
// therefore downloaded, parsed and rendered everything twice, which is the
// worst single thing that happens to "how long until I can use it". There is
// nothing stale to escape on a first visit: the page and the worker that just
// claimed it were served in the same breath.
if ('serviceWorker' in navigator) {
  const hadController = navigator.serviceWorker.controller != null
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload()
  })
}

// Open the connection to Supabase while the first screen is still painting.
// Auth is not on the critical path — `/dzis` renders entirely from IndexedDB —
// but `initAuthListener` fires right after the first commit, and without this
// its first request pays DNS + TLS + TCP in full at exactly the moment the app
// is assembling. Done here rather than as a <link> in index.html because the
// origin comes from the environment, and a missing variable there would ship a
// literal `%VITE_SUPABASE_URL%` as an href.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
if (supabaseUrl) {
  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = new URL(supabaseUrl).origin
  link.crossOrigin = ''
  document.head.appendChild(link)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
