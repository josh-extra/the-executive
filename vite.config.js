import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'The Executive',
        short_name: 'Executive',
        description: 'Your private dashboard for wealth, health and performance.',
        theme_color: '#080808',
        background_color: '#080808',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/app',
        start_url: '/app',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,jpg,webp}'],
        // Don't cache API calls - handle offline gracefully in app code
        navigateFallback: '/app',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // Never cache AI or Stripe - must be online
          {
            urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/api\.stripe\.com\/.*/i,
            handler: 'NetworkOnly'
          },
          // Never cache market data - the app already handles its own
          // refresh timing (throttled requests + interval polling), and
          // stale-while-revalidate was silently serving old/empty cached
          // responses for up to 5 minutes at a time while genuinely
          // fresh data was fetched in the background and discarded.
          {
            urlPattern: /\/api\/quote/,
            handler: 'NetworkOnly'
          },
          // Cache news for 10 minutes
          {
            urlPattern: /\/api\/news/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'news-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 600 }
            }
          },
          // Cache Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          // Cache Unsplash background photos for 7 days
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bg-photos',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })
  ],
  build: {
    minify: 'esbuild'
  }
})