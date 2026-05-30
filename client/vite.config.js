import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3002'

// Shared by dev (`server`) and built-asset preview (`preview`). E2E runs against
// `vite preview` (static, pre-built chunks) so lazy route imports are served as
// files rather than transformed on demand; preview ignores `server.proxy`, so the
// same proxy must be declared under both keys.
const proxyConfig = {
  '/api': {
    target: apiProxyTarget,
    proxyTimeout: 0,
    timeout: 0,
  },
  '/share': apiProxyTarget,
  '/uploads': apiProxyTarget,
  '/vendor': apiProxyTarget,
  '/ws': {
    target: apiProxyTarget,
    ws: true,
  },
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react()],
  server: {
    proxy: proxyConfig,
  },
  preview: {
    proxy: proxyConfig,
  },
  optimizeDeps: {
    include: ['revealjs-shared'],
  },
  build: {
    // The WYSIWYG editor route is intentionally heavy, but it is lazy-loaded
    // from App.jsx so the initial shell stays small.
    chunkSizeWarningLimit: 2500,
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
