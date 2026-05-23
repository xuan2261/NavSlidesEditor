import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3002'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiProxyTarget,
      '/share': apiProxyTarget,
      '/uploads': apiProxyTarget,
      '/vendor': apiProxyTarget,
      '/ws': {
        target: apiProxyTarget,
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: ['revealjs-shared'],
  },
  build: {
    commonjsOptions: {
      // Match both the package name and the actual resolved file paths
      // (workspace symlinks resolve to shared/src/ not node_modules/revealjs-shared/)
      include: [/revealjs-shared/, /shared\/src\//, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-reveal': ['reveal.js'],
          'vendor-katex': ['katex'],
          'vendor-lucide': ['lucide-react'],
          'vendor-tiptap': [
            '@tiptap/core',
            '@tiptap/starter-kit',
            '@tiptap/extension-text-style',
          ],
        },
      },
    },
  },
})
