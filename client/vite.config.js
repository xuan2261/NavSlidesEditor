import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3002',
      '/uploads': 'http://localhost:3002',
      '/vendor': 'http://localhost:3002',
      '/ws': {
        target: 'http://localhost:3002',
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
  },
})
