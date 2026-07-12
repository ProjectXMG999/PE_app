import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './styles/global.css'
import { pushLog } from './debug/audioLogger'

// Intercept console logs for debug overlay (captures [audio], [action], [seq] prefixes)
const origLog = console.log.bind(console)
const origErr = console.error.bind(console)
console.log = (...args) => {
  origLog(...args)
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  if (msg.includes('[audio]') || msg.includes('[action]') || msg.includes('[seq]')) {
    pushLog(msg)
  }
}
console.error = (...args) => {
  origErr(...args)
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  if (msg.includes('[audio]') || msg.includes('[action]') || msg.includes('[seq]')) {
    pushLog('ERR ' + msg)
  }
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
