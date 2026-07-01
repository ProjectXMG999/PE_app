import { defineConfig, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

// Dev-only plugin: serve audio files from audio-output/ instead of Netlify Blobs
function localAudioPlugin() {
  return {
    name: 'local-audio',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/.netlify/functions/audio')) return next()
        const urlObj = new URL(req.url, 'http://localhost')
        const pack = urlObj.searchParams.get('pack')?.replace(/[^a-zA-Z0-9_-]/g, '')
        const file = urlObj.searchParams.get('file')?.replace(/[^a-zA-Z0-9_.-]/g, '')
        if (!pack || !file || !file.endsWith('.mp3')) {
          res.writeHead(400); res.end(); return
        }
        const filePath = path.resolve('audio-output', pack, file)
        if (!fs.existsSync(filePath)) {
          res.writeHead(404); res.end(); return
        }
        const data = fs.readFileSync(filePath)
        res.setHeader('Content-Type', 'audio/mpeg')
        res.setHeader('Content-Length', String(data.length))
        res.setHeader('Accept-Ranges', 'bytes')
        res.setHeader('Cache-Control', 'no-cache')
        res.writeHead(200)
        res.end(data)
      })
    },
  }
}

export default defineConfig({
  plugins: [
    localAudioPlugin(),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,json,png,svg,webmanifest,woff,woff2}'],
      },
      manifest: {
        name: 'Project English',
        short_name: 'PE',
        description: 'Ucz się angielskiego offline — fiszki i auto-play',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0D0B1E',
        theme_color: '#8B5CF6',
        lang: 'pl',
        categories: ['education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
        screenshots: [
          { src: '/screenshots/home.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow' },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['recharts'],
          'store-vendor': ['zustand', 'idb'],
        },
      },
    },
  },
})
