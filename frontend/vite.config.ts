import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      // CRITICAL: Point ~backend to the generated client file to avoid loading Encore code
      '~backend': path.resolve(__dirname, './client.ts'),
      // Allow importing Clerk's internal AuthContext (not exposed via package.json exports)
      '@clerk/clerk-react/dist/chunk-F54Q6IK5.mjs': path.resolve(__dirname, '../node_modules/@clerk/clerk-react/dist/chunk-F54Q6IK5.mjs'),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['talea_logo.png', 'tavi.png', 'loading-animation.lottie'],
      manifest: {
        name: 'Talea - KI-Storytelling',
        short_name: 'Talea',
        description: 'KI-gestuetzte Storytelling-Plattform fuer Kinder',
        theme_color: '#7c3aed',
        background_color: '#1a0a2e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'de',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,lottie}'],
        // CRITICAL: config.js is generated dynamically at container startup
        globIgnores: ['config.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB - main bundle is ~2.5 MB
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/auth/,
          /^\/avatar\//,
          /^\/story\//,
          /^\/doku\//,
          /^\/ai\//,
          /^\/admin\//,
          /^\/user\//,
          /^\/tavi\//,
          /^\/log\//,
          /^\/health\//,
          /^\/clerk/,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/config\.js$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'config-cache',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    minify: 'esbuild',
    sourcemap: false,
  }
})
