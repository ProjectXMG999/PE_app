import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      registerType: 'prompt',
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
