import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    fileParallelism: false,
    globals: true,
    environment: 'jsdom',
  },
})
