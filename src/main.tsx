import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './styles/global.css'
import { pushLog } from './debug/audioLogger'

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
const TAGS = ['[audio]', '[action]', '[seq]']
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

// Force reload when a new SW takes control — prevents stale chunk 404s after deploy
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
