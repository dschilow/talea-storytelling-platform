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

export default defineConfig(({ mode }) => ({
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
    {
      name: 'talea-dev-runtime-config',
      // Production generates this file in docker-entrypoint.sh. A missing
      // classic script falls back to Vite's module HTML during development.
      configureServer(server) {
        server.middlewares.use('/config.js', (_request, response) => {
          response.setHeader('Content-Type', 'application/javascript');
          response.end('window.ENV = window.ENV || {};');
        });
      },
    },
    tailwindcss(),
    react(),
    VitePWA({
      // Android ships this exact frontend in the APK. Its app shell is served
      // by the native asset loader; a website service worker must not replace it.
      disable: mode === 'android',
      injectRegister: false,
      // Updates never reload a tab on their own; main.tsx applies them during
      // start-up or after a tap on its update toast.
      registerType: 'prompt',
      includeAssets: ['talea_logo.png', 'favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'brand/*.svg', 'fonts/*.woff2', 'tavi.png', 'loading-animation.lottie'],
      manifest: {
        name: 'Talea – Deine Geschichtenwelt',
        short_name: 'Talea',
        description: 'Persönliche Geschichten und Wissenswelten für Kinder zum Lesen und Hören',
        theme_color: '#FFF7EC',
        background_color: '#FFF7EC',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'de',
        icons: [
          {
            src: 'pwa-192x192.png?v=logo-v5',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png?v=logo-v5',
            sizes: '512x512',
            type: 'image/png',
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
          // Small brand vectors and the display face remain available offline.
          'brand/*.svg',
          'fonts/*.woff2',
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
          // Self-hosted fonts: only the Latin subsets are needed offline; the
          // others load on demand when a page actually shows such characters.
          'assets/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2',
        ],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Take control of the very first page load. Without this the SW only
        // starts serving on the *next* navigation, so a network that dies during
        // a user's first session leaves the offline shell unable to fetch its
        // own lazy chunks.
        clientsClaim: true,
        skipWaiting: false,
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
            // Font subsets left out of the precache (see globIgnores).
            urlPattern: /\/assets\/.*\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-subsets',
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // index.html loads this as a BLOCKING script. On a flaky link
            // (train tunnel, captive portal) a plain NetworkFirst would hang
            // the whole app start until the browser gives up; fall back to the
            // cached copy after a few seconds instead.
            urlPattern: /\/config\.js$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'config-cache',
              networkTimeoutSeconds: 3,
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
        // Dozens of individual icon chunks add round trips on mobile networks.
        // Group icons, but keep React in the shared app graph to avoid cycles.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/node_modules/lucide-react/')) return 'icons';
          if (normalized.includes('/node_modules/three/')) return 'three-vendor';
        },
      },
    },
  }
}))
