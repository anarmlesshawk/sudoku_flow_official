import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(
  base: '/sudoku_flow_official/'
  plugins: [
    react(),

    // ─── PWA Plugin ───────────────────────────────────────────────
    // This does three things automatically when you run `npm run build`:
    //   1. Generates a service worker that caches your app for offline use
    //   2. Injects the <link rel="manifest"> tag into index.html
    //   3. Handles cache updates when you ship a new version
    VitePWA({
      registerType: 'autoUpdate',   // silently update the service worker in background
      includeAssets: [
        'icons/*.png',
        'icons/*.svg',
        'favicon.ico'
      ],

      // ── Web App Manifest ────────────────────────────────────────
      // This is what makes "Add to Home Screen" work on iOS and Android.
      // It's also what Chrome uses to decide if the install prompt fires.
      manifest: {
        name: 'Sudoku Flow',
        short_name: 'Sudoku Flow',   // shown under the icon on home screen
        description: 'Daily Sudoku puzzles with streaks, goals and beautiful themes.',
        theme_color: '#0f0f1a',      // matches Midnight theme bg — status bar colour on Android
        background_color: '#0f0f1a', // splash screen background colour
        display: 'standalone',       // hides browser chrome — feels like a native app
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'           // standard home screen icon
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'      // Android adaptive icon — safe zone applies
          }
        ]
      },

      // ── Workbox (Service Worker) config ─────────────────────────
      // Workbox is Google's library that powers the service worker.
      // This config caches everything so the app works fully offline.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Network first for the HTML shell, cache first for assets
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },

      // ── Dev options ─────────────────────────────────────────────
      devOptions: {
        enabled: false   // don't run service worker in dev — it causes confusing caching
      }
    })
  ],

  // ── Build options ──────────────────────────────────────────────
  build: {
    outDir: 'dist',
    sourcemap: false,   // set to true if you want to debug production builds
    rollupOptions: {
      output: {
        // Split vendor code into a separate chunk — improves caching
        // (React itself won't re-download when you push app updates)
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  }
})
