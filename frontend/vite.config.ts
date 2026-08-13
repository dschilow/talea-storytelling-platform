import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Resolve the Clerk internal chunk that exports AuthContext.
// The chunk filename is stable within a version but can't be imported directly
// because @clerk/clerk-react doesn't expose it via its package.json "exports" map.
// We find it by reading internal.mjs which imports AuthContext from the chunk.
function resolveClerkAuthChunk(): string {
  const require_ = createRequire(import.meta.url)
  // Find the @clerk/clerk-react package directory via its package.json
  const pkgJsonPath = require_.resolve('@clerk/clerk-react/package.json')
  const distDir = path.join(path.dirname(pkgJsonPath), 'dist')
  // Read the ESM internal module (always at dist/internal.mjs)
  const internalSrc = fs.readFileSync(path.join(distDir, 'internal.mjs'), 'utf-8')
  // internal.mjs imports useDerivedAuth from the chunk that also defines AuthContext
  // e.g.: useDerivedAuth\n} from "./chunk-F54Q6IK5.mjs";
  const match = internalSrc.match(/useDerivedAuth[\s\S]*?from\s+["']\.\/(chunk-[A-Za-z0-9_-]+\.mjs)["']/)
  if (!match) throw new Error('Could not find AuthContext chunk in @clerk/clerk-react/internal')
  return path.join(distDir, match[1])
}

const clerkAuthChunkPath = resolveClerkAuthChunk()

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      // CRITICAL: Point ~backend to the generated client file to avoid loading Encore code
      '~backend': path.resolve(__dirname, './client.ts'),
      // Allow importing Clerk's internal AuthContext (not exposed via package.json exports).
      // The chunk name is resolved dynamically so it works regardless of npm/bun hoisting.
      '@clerk-internal/auth-context': clerkAuthChunkPath,
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      injectRegister: false,
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
        // Precache the APP SHELL only (~3 MB). Precaching every png/svg pulled in
        // ~28 MB of landing-assets/textures and pushed browsers into storage
        // pressure, which is why the SW had to be force-disabled before. Heavy
        // media is runtime-cached below with a hard entry cap instead.
        globPatterns: [
          '**/*.{js,css,html,woff2}',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'talea_logo.png',
          'loading-animation.lottie',
          // Bundled chrome image (imported by the sidebar). The other hashed
          // images in assets/ are 1 MB+ Lernpfad maps for an online-only screen
          // and stay runtime-cached.
          'assets/talea_logo-*.png',
        ],
        globIgnores: [
          // CRITICAL: config.js is generated dynamically at container startup
          'config.js',
          // Online-only features (3D cosmos, PDF export) — no need to reserve
          // ~1.6 MB of the offline budget for chunks that cannot work offline.
          'assets/three-vendor-*.js',
          'assets/CosmosScreen-*.js',
          'assets/pdfExport-*.js',
          'assets/html2canvas*.js',
        ],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Take control of the very first page load. Without this the SW only
        // starts serving on the *next* navigation, so a network that dies during
        // a user's first session leaves the offline shell unable to fetch its
        // own lazy chunks.
        clientsClaim: true,
        skipWaiting: true,
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
            },
          },
          {
            // Chunks deliberately kept out of the precache: still served from
            // cache on a repeat visit, but they never block an install.
            urlPattern: /\/assets\/(three-vendor|CosmosScreen|pdfExport|html2canvas)[^/]*\.js$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'heavy-chunks',
              expiration: { maxEntries: 12, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Decorative media (landing page, 3D textures, UI illustrations).
            // Capped so a browsing session can never eat the storage quota that
            // offline stories/audio in IndexedDB depend on.
            urlPattern: /\/(landing-assets|textures|assets)\/.*\.(?:png|jpe?g|webp|svg|avif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-media',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Three.js ecosystem → separate chunk (lazy-loaded via React.lazy Cosmos routes)
          'three-vendor': ['three'],
        },
      },
    },
  }
})
