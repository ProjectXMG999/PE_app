import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './styles/global.css'
import { pushLog } from './debug/audioLogger'
import { runSplash } from './boot/splash'

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

// Force reload when a new SW takes control — prevents stale chunk 404s after deploy
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

// Before the mount, not inside a component: the curtain is already on screen by
// now (index.html painted it), it is not React's to own, and StrictMode would
// otherwise run its arming twice.
runSplash()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
