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
