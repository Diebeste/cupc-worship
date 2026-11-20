import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/cupc-worship/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'logo-wordmark.png',
        'logo-mark.png',
        'icons/favicon.ico',
        'icons/favicon-16.png',
        'icons/favicon-32.png',
        'icons/apple-touch-icon.png'
      ],
      manifest: {
        name: 'CUPC Mississauga Worship',
        short_name: 'CUPC Worship',
        description:
          'Song library, setlists, and key transpose for the CUPC Mississauga worship team',
        theme_color: '#182848',
        background_color: '#182848',
        display: 'standalone',
        orientation: 'any',
        lang: 'en',
        start_url: '/cupc-worship/',
        scope: '/cupc-worship/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        cacheId: 'cupc-worship-v4',
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,json,mjs}'],
        navigateFallback: '/cupc-worship/index.html',
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ]
})
