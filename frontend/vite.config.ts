import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      // CRITICAL: Point ~backend to the generated client file to avoid loading Encore code
      '~backend': path.resolve(__dirname, './client'),
    },
  },
  plugins: [tailwindcss(), react()],
  build: {
    minify: 'esbuild',
    sourcemap: false,
  }
})
