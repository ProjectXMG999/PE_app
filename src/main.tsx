import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './styles/global.css'
import { registerSW } from 'virtual:pwa-register'

// Reload the page when a new SW takes control — prevents stale chunk 404s
registerSW({
  onNeedRefresh() {},
  onOfflineReady() {},
  immediate: true,
})

// Force reload when SW activates with a new version
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
