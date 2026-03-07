import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './SudokuApp.jsx'

// ── Register Service Worker ────────────────────────────────────────
// vite-plugin-pwa generates 'sw.js' in the dist folder at build time.
// This code registers it so the browser starts caching assets.
// It only runs in production (not during `npm run dev`).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err))
  })
}

// ── Mount React ────────────────────────────────────────────────────
// StrictMode runs component logic twice in development to catch bugs.
// It has zero effect in the production build.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
