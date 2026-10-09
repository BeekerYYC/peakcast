import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Shown in Settings so it's obvious which version the phone is running.
const BUILD = `${(process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`

const tileCache = (name: string, pattern: RegExp) => ({
  urlPattern: pattern,
  handler: 'CacheFirst' as const,
  options: {
    cacheName: name,
    expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 },
    cacheableResponse: { statuses: [0, 200] },
  },
})

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered manually in src/lib/sw.ts so we can check for updates on launch.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        id: '/',
        name: 'Peakcast',
        short_name: 'Peakcast',
        description: 'Mountain weather: compare forecast models side by side.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0d0d0d',
        theme_color: '#0d366b',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Widget files must always come fresh from the network (Scriptable and
        // the setup page read them), never from the app's offline copy.
        globIgnores: ['**/widget*.js', '**/widget-install.html'],
        // MapPicker (MapLibre) is ~1 MB; precache it so the map opens offline.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Static pages (widget setup) must not be swallowed by the SPA.
        navigateFallbackDenylist: [/^\/widget/],
        cleanupOutdatedCaches: true,
        // Forecast data is cached by the app in IndexedDB (with fetch times),
        // so API calls are network-only here. Map tiles are cached.
        runtimeCaching: [
          tileCache('tiles-topo', /^https:\/\/[abc]\.tile\.opentopomap\.org\/.*/),
          tileCache('tiles-ofm', /^https:\/\/tiles\.openfreemap\.org\/.*/),
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
