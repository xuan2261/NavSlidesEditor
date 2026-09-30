import { defineConfig } from 'vitest/config'
import clientJsdom from './config/vitest/client-jsdom.config.mjs'
import nodeParallel from './config/vitest/node-parallel.config.mjs'
import nodeSerial from './config/vitest/node-serial.config.mjs'

export default defineConfig({
  test: {
    projects: [clientJsdom, nodeParallel, nodeSerial],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 74,
        branches: 60,
        functions: 68,
        statements: 71,
      },
      include: [
        'client/src/**/*.{js,jsx}',
        'server/**/*.js',
        'shared/src/**/*.js',
      ],
      exclude: [
        '**/*.test.{js,jsx}',
        '**/__tests__/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/dist-electron/**',
        'tests/**',
        'client/src/main.jsx',
        'client/public/**',
        'electron/**',
        'server/vendor/**',
        'server/uploads/**',
        'server/data/**',
        'server/scripts/**',
        'server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js',
      ],
    },
  },
})
